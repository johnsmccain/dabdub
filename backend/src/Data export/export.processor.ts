import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { addDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

import { ExportJob } from '../entities/export-job.entity';
import { ExportStatus } from '../enums/export.enums';
import { S3Service } from './s3.service';
import { ExportDataService } from './export-data.service';
import { ExportWriter } from '../utils/export-writer.util';
import { COLUMN_DEFINITIONS } from '../utils/column-definitions';

export const EXPORT_QUEUE = 'export-processing';
export const NOTIFICATIONS_QUEUE = 'notifications';

@Processor(EXPORT_QUEUE)
export class ExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(
    @InjectRepository(ExportJob)
    private readonly exportJobRepo: Repository<ExportJob>,
    private readonly s3Service: S3Service,
    private readonly exportDataService: ExportDataService,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ exportJobId: string }>): Promise<void> {
    const { exportJobId } = job.data;

    const exportJob = await this.exportJobRepo.findOneByOrFail({ id: exportJobId });

    await this.exportJobRepo.update(exportJob.id, {
      status: ExportStatus.PROCESSING,
    });

    const s3Key = `exports/${exportJob.adminId}/${uuidv4()}.${exportJob.format.toLowerCase()}`;
    const { stream, done } = this.s3Service.createUploadStream(s3Key);

    const writer = new ExportWriter(stream, exportJob.format);
    writer.writeHeader(COLUMN_DEFINITIONS[exportJob.resourceType]);

    const BATCH_SIZE = 1000;
    const estimatedTotal = exportJob.estimatedRowCount ?? 1;
    let cursor: string | null = null;
    let processedCount = 0;

    try {
      do {
        const { data, nextCursor } = await this.exportDataService.fetchBatch(
          exportJob.resourceType,
          exportJob.filters,
          cursor,
          BATCH_SIZE,
        );

        writer.writeRows(data);
        processedCount += data.length;
        cursor = nextCursor;

        const progress = Math.min(
          Math.round((processedCount / estimatedTotal) * 100),
          99, // Reserve 100 for when upload completes
        );
        await job.updateProgress(progress);
        await this.exportJobRepo.update(exportJob.id, {
          progressPercentage: progress,
        });
      } while (cursor !== null);

      await writer.end();
      await done();

      const fileSizeBytes = await this.s3Service.getObjectSize(s3Key);

      await this.exportJobRepo.update(exportJob.id, {
        status: ExportStatus.COMPLETED,
        actualRowCount: processedCount,
        s3Key,
        fileSizeBytes,
        progressPercentage: 100,
        completedAt: new Date(),
        expiresAt: addDays(new Date(), 7),
      });

      await job.updateProgress(100);

      await this.notificationsQueue.add('export-ready', {
        exportJobId: exportJob.id,
        adminId: exportJob.adminId,
      });

      this.logger.log(
        `Export ${exportJob.id} completed: ${processedCount} rows, ${fileSizeBytes} bytes`,
      );
    } catch (err) {
      this.logger.error(`Export ${exportJob.id} failed`, err);

      await this.exportJobRepo.update(exportJob.id, {
        status: ExportStatus.FAILED,
        failureReason: err instanceof Error ? err.message : String(err),
      });

      throw err; // Let BullMQ handle retry/failure
    }
  }
}
