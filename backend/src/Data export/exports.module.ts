import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { ExportJob } from './entities/export-job.entity';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { ExportDataService } from './services/export-data.service';
import { S3Service } from './services/s3.service';
import { ExportProcessor, EXPORT_QUEUE, NOTIFICATIONS_QUEUE } from './processors/export.processor';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ExportJob]),
    BullModule.registerQueue(
      { name: EXPORT_QUEUE },
      { name: NOTIFICATIONS_QUEUE },
    ),
  ],
  controllers: [ExportsController],
  providers: [
    ExportsService,
    ExportDataService,
    S3Service,
    ExportProcessor,
  ],
  exports: [ExportsService],
})
export class ExportsModule {}
