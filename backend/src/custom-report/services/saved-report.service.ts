import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Or } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SavedReport } from '../entities/saved-report.entity';
import { ReportRun } from '../entities/report-run.entity';
import {
  CreateSavedReportDto,
  UpdateSavedReportDto,
  ScheduleReportDto,
  ListReportsQueryDto,
} from '../dto/saved-report.dto';
import {
  QueryBuilderService,
  RUN_ROW_LIMIT,
  PREVIEW_LIMIT,
} from './query-builder.service';
import { CronValidatorService } from './cron-validator.service';
import { ExportFormat, ReportRunStatus } from '../enums/report.enums';
import { UserRole } from 'src/database/entities/user.entity';

export const CUSTOM_REPORT_QUEUE = 'custom-reports';

export interface CustomReportJobPayload {
  reportId: string;
  runId: string;
  format: ExportFormat;
  triggeredById: string;
  isScheduled: boolean;
}

@Injectable()
export class SavedReportService {
  private readonly logger = new Logger(SavedReportService.name);

  constructor(
    @InjectRepository(SavedReport)
    private readonly reportRepo: Repository<SavedReport>,
    @InjectRepository(ReportRun)
    private readonly runRepo: Repository<ReportRun>,
    @InjectQueue(CUSTOM_REPORT_QUEUE)
    private readonly reportQueue: Queue,
    private readonly queryBuilder: QueryBuilderService,
    private readonly cronValidator: CronValidatorService,
  ) {}

  // ── List ─────────────────────────────────────────────────────────────────────

  async listReports(
    adminId: string,
    query: ListReportsQueryDto,
  ): Promise<SavedReport[]> {
    const qb = this.reportRepo
      .createQueryBuilder('r')
      .where('r.deletedAt IS NULL')
      .andWhere('(r.createdById = :adminId OR r.isShared = true)', { adminId });

    if (query.dataSource)
      qb.andWhere('r.dataSource = :ds', { ds: query.dataSource });
    if (query.isScheduled !== undefined)
      qb.andWhere('r.isScheduled = :sched', { sched: query.isScheduled });
    if (query.isShared !== undefined)
      qb.andWhere('r.isShared = :shared', { shared: query.isShared });

    return qb.orderBy('r.createdAt', 'DESC').getMany();
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async create(
    dto: CreateSavedReportDto,
    adminId: string,
  ): Promise<SavedReport> {
    // Validate all field names against whitelist before persisting
    this.queryBuilder.validateFields(
      dto.dataSource,
      dto.columns,
      dto.filters,
      dto.sorting,
    );

    const report = this.reportRepo.create({
      ...dto,
      createdById: adminId,
      isScheduled: false,
      scheduleExpression: null,
      scheduleRecipientEmails: [],
      lastRunAt: null,
      runCount: 0,
    });

    return this.reportRepo.save(report);
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────────

  async findById(id: string, adminId: string): Promise<SavedReport> {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    this.assertCanRead(report, adminId);
    return report;
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateSavedReportDto,
    adminId: string,
    adminRole: UserRole,
  ): Promise<SavedReport> {
    const report = await this.findByIdInternal(id);
    this.assertCanModify(report, adminId, adminRole);

    // Re-validate field names if any of the query definition changed
    const newCols = dto.columns ?? report.columns;
    const newFilts = dto.filters ?? report.filters;
    const newSorts = dto.sorting ?? report.sorting;
    this.queryBuilder.validateFields(
      report.dataSource,
      newCols,
      newFilts,
      newSorts,
    );

    Object.assign(report, dto);
    return this.reportRepo.save(report);
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async delete(
    id: string,
    adminId: string,
    adminRole: UserRole,
  ): Promise<void> {
    const report = await this.findByIdInternal(id);
    this.assertCanModify(report, adminId, adminRole);
    await this.reportRepo.softDelete(id);
  }

  // ── Run ───────────────────────────────────────────────────────────────────────

  async run(
    id: string,
    adminId: string,
    format?: ExportFormat,
  ): Promise<{ jobId: string; estimatedRows: number; runId: string }> {
    const report = await this.findById(id, adminId);

    // Count rows before enqueuing — refuse if > 500k
    const estimatedRows = await this.queryBuilder.countRows(
      report.dataSource,
      report.columns,
      report.filters,
      report.sorting,
    );

    if (estimatedRows > RUN_ROW_LIMIT) {
      throw new UnprocessableEntityException(
        `Report would generate ${estimatedRows.toLocaleString()} rows which exceeds the ` +
          `maximum of ${RUN_ROW_LIMIT.toLocaleString()}. Add more filters to narrow the result set.`,
      );
    }

    const chosenFormat = format ?? report.defaultFormat;

    // Create a run record in PENDING state
    const run = this.runRepo.create({
      reportId: report.id,
      status: ReportRunStatus.PENDING,
      format: chosenFormat,
      triggeredById: adminId,
      isScheduled: false,
      rowCount: null,
      fileSizeBytes: null,
      downloadUrl: null,
      jobId: null,
    });
    const savedRun = await this.runRepo.save(run);

    // Enqueue the job
    const payload: CustomReportJobPayload = {
      reportId: report.id,
      runId: savedRun.id,
      format: chosenFormat,
      triggeredById: adminId,
      isScheduled: false,
    };
    const job = await this.reportQueue.add('generate', payload, {
      attempts: 3,
      backoff: 5000,
    });

    // Store jobId on run
    await this.runRepo.update(savedRun.id, { jobId: String(job.id) });

    return { jobId: String(job.id), estimatedRows, runId: savedRun.id };
  }

  // ── Preview ───────────────────────────────────────────────────────────────────

  async preview(
    id: string,
    adminId: string,
  ): Promise<{
    columns: string[];
    rows: unknown[][];
    totalMatchingRows: number;
    previewRowCount: number;
  }> {
    const report = await this.findById(id, adminId);

    const includedCols = report.columns.filter((c) => c.include);
    const columnAliases = includedCols.map((c) => c.alias);

    // Run both preview fetch + count in parallel for speed
    const [rawRows, totalMatchingRows] = await Promise.all([
      this.queryBuilder.preview(
        report.dataSource,
        report.columns,
        report.filters,
        report.sorting,
        PREVIEW_LIMIT,
      ),
      this.queryBuilder.countRows(
        report.dataSource,
        report.columns,
        report.filters,
        report.sorting,
      ),
    ]);

    // Convert object rows → ordered arrays using column aliases
    const rows = rawRows.map((row) =>
      columnAliases.map((alias) => row[alias] ?? null),
    );

    return {
      columns: columnAliases,
      rows,
      totalMatchingRows,
      previewRowCount: rawRows.length,
    };
  }

  // ── Schedule ──────────────────────────────────────────────────────────────────

  async schedule(
    id: string,
    dto: ScheduleReportDto,
    adminId: string,
    adminRole: UserRole,
  ): Promise<SavedReport> {
    const report = await this.findByIdInternal(id);
    this.assertCanModify(report, adminId, adminRole);

    if (dto.enabled) {
      if (!dto.scheduleExpression) {
        throw new BadRequestException(
          'scheduleExpression is required when enabling a schedule',
        );
      }
      // Validate cron — throws 400 with parse error details on failure
      this.cronValidator.validate(dto.scheduleExpression);

      report.isScheduled = true;
      report.scheduleExpression = dto.scheduleExpression;
      if (dto.recipientEmails)
        report.scheduleRecipientEmails = dto.recipientEmails;
      if (dto.format) report.defaultFormat = dto.format;
    } else {
      report.isScheduled = false;
      report.scheduleExpression = null;
    }

    return this.reportRepo.save(report);
  }

  // ── Run history ───────────────────────────────────────────────────────────────

  async getRuns(id: string, adminId: string): Promise<ReportRun[]> {
    await this.findById(id, adminId); // access check
    return this.runRepo.find({
      where: { reportId: id },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  // ── Called by scheduler ───────────────────────────────────────────────────────

  async enqueueScheduledRun(report: SavedReport): Promise<void> {
    const run = this.runRepo.create({
      reportId: report.id,
      status: ReportRunStatus.PENDING,
      format: report.defaultFormat,
      triggeredById: null,
      isScheduled: true,
    });
    const savedRun = await this.runRepo.save(run);

    const payload: CustomReportJobPayload = {
      reportId: report.id,
      runId: savedRun.id,
      format: report.defaultFormat,
      triggeredById: 'scheduler',
      isScheduled: true,
    };

    const job = await this.reportQueue.add('generate', payload, {
      attempts: 3,
    });
    await this.runRepo.update(savedRun.id, { jobId: String(job.id) });

    this.logger.log(
      `Scheduled run enqueued for report ${report.id} (job: ${job.id})`,
    );
  }

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async findByIdInternal(id: string): Promise<SavedReport> {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  private assertCanRead(report: SavedReport, adminId: string): void {
    if (!report.isShared && report.createdById !== adminId) {
      throw new ForbiddenException('You do not have access to this report');
    }
  }

  private assertCanModify(
    report: SavedReport,
    adminId: string,
    adminRole: UserRole,
  ): void {
    if (report.createdById !== adminId && adminRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only the report creator or a SUPER_ADMIN can modify this report',
      );
    }
  }
}
