import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  GoneException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { ExportJob } from '../entities/export-job.entity';
import { ExportStatus } from '../enums/export.enums';
import { CreateExportDto } from '../dto/create-export.dto';
import { ExportDataService } from './export-data.service';
import { S3Service } from './s3.service';
import { EXPORT_QUEUE } from '../processors/export.processor';

const MAX_ROW_LIMIT = 500_000;
const PRESIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    @InjectRepository(ExportJob)
    private readonly exportJobRepo: Repository<ExportJob>,
    private readonly exportDataService: ExportDataService,
    private readonly s3Service: S3Service,
    @InjectQueue(EXPORT_QUEUE)
    private readonly exportQueue: Queue,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /api/v1/exports
  // ---------------------------------------------------------------------------
  async createExport(adminId: string, dto: CreateExportDto) {
    const estimatedRowCount = await this.exportDataService.countRows(
      dto.resourceType,
      dto.filters as Record<string, unknown>,
    );

    if (estimatedRowCount > MAX_ROW_LIMIT) {
      throw new UnprocessableEntityException(
        `Export would contain ${estimatedRowCount.toLocaleString()} rows, which exceeds the maximum of ${MAX_ROW_LIMIT.toLocaleString()}. Please narrow your filters.`,
      );
    }

    const exportJob = this.exportJobRepo.create({
      adminId,
      resourceType: dto.resourceType,
      filters: dto.filters as Record<string, unknown>,
      format: dto.format,
      status: ExportStatus.QUEUED,
      estimatedRowCount,
    });

    await this.exportJobRepo.save(exportJob);

    await this.exportQueue.add(
      'process-export',
      { exportJobId: exportJob.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(`Export ${exportJob.id} queued for admin ${adminId}`);

    return {
      exportId: exportJob.id,
      status: ExportStatus.QUEUED,
      estimatedRowCount,
      format: dto.format.toLowerCase(),
      message: 'Export queued. You will receive an email with the download link when ready.',
    };
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/exports/:id
  // ---------------------------------------------------------------------------
  async getExport(id: string, requestingAdminId: string, isSuperAdmin: boolean) {
    const exportJob = await this.exportJobRepo.findOneBy({ id });

    if (!exportJob) {
      throw new NotFoundException(`Export job ${id} not found`);
    }

    if (!isSuperAdmin && exportJob.adminId !== requestingAdminId) {
      throw new NotFoundException(`Export job ${id} not found`);
    }

    if (exportJob.status === ExportStatus.COMPLETED && exportJob.expiresAt) {
      if (exportJob.expiresAt < new Date()) {
        throw new GoneException('This export has expired and the file is no longer available.');
      }
    }

    let downloadUrl: string | undefined;
    let downloadUrlExpiresAt: Date | undefined;

    if (exportJob.status === ExportStatus.COMPLETED && exportJob.s3Key) {
      downloadUrl = await this.s3Service.getPresignedUrl(
        exportJob.s3Key,
        PRESIGNED_URL_TTL_SECONDS,
      );
      downloadUrlExpiresAt = exportJob.expiresAt ?? undefined;
    }

    return {
      id: exportJob.id,
      resourceType: exportJob.resourceType,
      status: exportJob.status,
      format: exportJob.format.toLowerCase(),
      progressPercentage: exportJob.progressPercentage,
      estimatedRowCount: exportJob.estimatedRowCount,
      actualRowCount: exportJob.actualRowCount,
      fileSizeBytes: exportJob.fileSizeBytes
        ? Number(exportJob.fileSizeBytes)
        : null,
      downloadUrl,
      downloadUrlExpiresAt,
      completedAt: exportJob.completedAt,
      expiresAt: exportJob.expiresAt,
      failureReason: exportJob.failureReason,
      requestedBy: { id: exportJob.adminId },
    };
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/exports
  // ---------------------------------------------------------------------------
  async listExports(requestingAdminId: string, isSuperAdmin: boolean) {
    const where = isSuperAdmin ? {} : { adminId: requestingAdminId };

    const jobs = await this.exportJobRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return jobs.map((j) => ({
      id: j.id,
      resourceType: j.resourceType,
      status: j.status,
      format: j.format.toLowerCase(),
      progressPercentage: j.progressPercentage,
      estimatedRowCount: j.estimatedRowCount,
      actualRowCount: j.actualRowCount,
      completedAt: j.completedAt,
      expiresAt: j.expiresAt,
      createdAt: j.createdAt,
    }));
  }
}
