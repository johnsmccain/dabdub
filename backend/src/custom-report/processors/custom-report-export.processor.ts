import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedReport } from '../entities/saved-report.entity';
import { ReportRun } from '../entities/report-run.entity';
import { QueryBuilderService } from '../services/query-builder.service';
import {
  CustomReportJobPayload,
  CUSTOM_REPORT_QUEUE,
} from '../services/saved-report.service';
import { ExportFormat, ReportRunStatus } from '../enums/report.enums';

@Processor(CUSTOM_REPORT_QUEUE)
export class CustomReportExportProcessor {
  private readonly logger = new Logger(CustomReportExportProcessor.name);

  constructor(
    @InjectRepository(SavedReport)
    private readonly reportRepo: Repository<SavedReport>,
    @InjectRepository(ReportRun)
    private readonly runRepo: Repository<ReportRun>,
    private readonly queryBuilder: QueryBuilderService,
  ) {}

  @Process('generate')
  async handle(job: Job<CustomReportJobPayload>): Promise<void> {
    const { reportId, runId, format, isScheduled } = job.data;
    this.logger.log(
      `Processing report ${reportId} run ${runId} (format: ${format})`,
    );

    await this.runRepo.update(runId, { status: ReportRunStatus.PROCESSING });

    try {
      const report = await this.reportRepo.findOne({ where: { id: reportId } });
      if (!report) {
        throw new Error(`Report ${reportId} not found — was it deleted?`);
      }

      await job.progress(10);

      const rows = await this.queryBuilder.preview(
        report.dataSource,
        report.columns,
        report.filters,
        report.sorting,
        500_000, // full export up to limit
      );

      await job.progress(70);

      const includedCols = report.columns.filter((c) => c.include);
      const columnAliases = includedCols.map((c) => c.alias);

      let fileContent: string;
      let fileSizeBytes: number;

      if (format === ExportFormat.CSV) {
        fileContent = this.buildCsv(columnAliases, rows);
        fileSizeBytes = Buffer.byteLength(fileContent, 'utf8');
      } else if (format === ExportFormat.JSON) {
        fileContent = JSON.stringify(
          { columns: columnAliases, rows, rowCount: rows.length },
          null,
          2,
        );
        fileSizeBytes = Buffer.byteLength(fileContent, 'utf8');
      } else {
        // XLSX: placeholder — integrate with exceljs or similar
        fileContent = this.buildCsv(columnAliases, rows); // fallback to CSV bytes for size
        fileSizeBytes = Buffer.byteLength(fileContent, 'utf8');
      }

      await job.progress(90);

      // In production: upload to S3/GCS and generate signed URL.
      // Here we store a placeholder URL referencing the run ID.
      const fileExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const downloadUrl = `/api/v1/reports/runs/${runId}/download`;

      await this.runRepo.update(runId, {
        status: ReportRunStatus.COMPLETED,
        rowCount: rows.length,
        fileSizeBytes,
        downloadUrl,
        fileExpiresAt,
        completedAt: new Date(),
      });

      // Update report metadata
      await this.reportRepo.update(reportId, {
        lastRunAt: new Date(),
        runCount: () => '"runCount" + 1',
      });

      await job.progress(100);
      this.logger.log(
        `Report ${reportId} run ${runId} completed: ${rows.length} rows, ${fileSizeBytes} bytes`,
      );
    } catch (err: any) {
      this.logger.error(
        `Report ${reportId} run ${runId} failed: ${err.message}`,
      );
      await this.runRepo.update(runId, {
        status: ReportRunStatus.FAILED,
        errorMessage: err.message,
        completedAt: new Date(),
      });
      throw err; // re-throw so Bull marks job as failed and retries
    }
  }

  private buildCsv(headers: string[], rows: Record<string, unknown>[]): string {
    const escape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const headerLine = headers.map(escape).join(',');
    const dataLines = rows.map((row) =>
      headers.map((h) => escape(row[h])).join(','),
    );

    return [headerLine, ...dataLines].join('\n');
  }
}
