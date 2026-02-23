import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportRun } from './entities/report-run.entity';
import { SavedReport } from './entities/saved-report.entity';
import { CustomReportExportProcessor } from './processors/custom-report-export.processor';
import { ReportsController } from './reports.controller';
import { CronValidatorService } from './services/cron-validator.service';
import { QueryBuilderService } from './services/query-builder.service';
import { ReportSchedulerService } from './services/report-scheduler.service';
import {
  CUSTOM_REPORT_QUEUE,
  SavedReportService,
} from './services/saved-report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavedReport, ReportRun]),
    BullModule.registerQueue({ name: CUSTOM_REPORT_QUEUE }),
    ScheduleModule.forRoot(),
  ],
  controllers: [ReportsController],
  providers: [
    SavedReportService,
    QueryBuilderService,
    CronValidatorService,
    ReportSchedulerService,
    CustomReportExportProcessor,
  ],
  exports: [SavedReportService],
})
export class CustomReportsModule {}
