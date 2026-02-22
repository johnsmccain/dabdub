import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';

import { ExportJob } from '../exports/entities/export-job.entity';
import { S3Service } from '../exports/services/s3.service';
import { NOTIFICATIONS_QUEUE } from '../exports/processors/export.processor';

const PRESIGNED_TTL = 7 * 24 * 60 * 60; // 7 days

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @InjectRepository(ExportJob)
    private readonly exportJobRepo: Repository<ExportJob>,
    private readonly s3Service: S3Service,
    private readonly mailerService: MailerService,
  ) {
    super();
  }

  async process(job: Job<{ exportJobId: string; adminId: string }>): Promise<void> {
    const { exportJobId } = job.data;

    const exportJob = await this.exportJobRepo.findOneByOrFail({ id: exportJobId });

    if (!exportJob.s3Key) {
      this.logger.warn(`Export ${exportJobId} has no S3 key; skipping notification`);
      return;
    }

    const downloadUrl = await this.s3Service.getPresignedUrl(exportJob.s3Key, PRESIGNED_TTL);

    // Replace with your actual admin lookup / email resolution
    const recipientEmail = `admin+${exportJob.adminId}@yourplatform.io`;

    await this.mailerService.sendMail({
      to: recipientEmail,
      subject: `Your ${exportJob.resourceType} export is ready`,
      template: 'export-ready', // points to templates/export-ready.hbs
      context: {
        resourceType: exportJob.resourceType,
        rowCount: exportJob.actualRowCount?.toLocaleString(),
        downloadUrl,
        expiresAt: exportJob.expiresAt?.toISOString(),
      },
    });

    this.logger.log(`Export-ready email sent for export ${exportJobId}`);
  }
}
