import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SavedReport } from '../entities/saved-report.entity';
import { SavedReportService } from './saved-report.service';

/**
 * Runs every minute. For each scheduled report whose cron expression
 * matches the current minute, enqueues a generation job.
 *
 * Uses the `cron` package to check whether the current time matches
 * the expression — same package already listed in package.json.
 */
@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(
    @InjectRepository(SavedReport)
    private readonly reportRepo: Repository<SavedReport>,
    private readonly reportService: SavedReportService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkDueReports(): Promise<void> {
    const scheduledReports = await this.reportRepo.find({
      where: { isScheduled: true },
    });

    if (scheduledReports.length === 0) return;

    const now = new Date();

    for (const report of scheduledReports) {
      if (!report.scheduleExpression) continue;

      try {
        if (this.matchesCron(report.scheduleExpression, now)) {
          this.logger.log(
            `Cron expression "${report.scheduleExpression}" matches now — enqueuing report ${report.id}`,
          );
          await this.reportService.enqueueScheduledRun(report);
        }
      } catch (err: any) {
        this.logger.error(
          `Error checking/enqueuing scheduled report ${report.id}: ${err.message}`,
        );
      }
    }
  }

  /**
   * Returns true if the given cron expression matches the minute represented by `now`.
   *
   * Uses manual part comparison — matches if minute, hour, day-of-month,
   * month, and day-of-week all satisfy the expression for `now`.
   */
  matchesCron(expression: string, now: Date): boolean {
    try {
      const parts = expression.trim().split(/\s+/);
      // Handle 5-part (min hour dom mon dow) or 6-part (sec min hour dom mon dow)
      const [minF, hourF, domF, monF, dowF] =
        parts.length === 6 ? parts.slice(1) : parts;

      return (
        this.fieldMatches(minF, now.getMinutes(), 0, 59) &&
        this.fieldMatches(hourF, now.getHours(), 0, 23) &&
        this.fieldMatches(domF, now.getDate(), 1, 31) &&
        this.fieldMatches(monF, now.getMonth() + 1, 1, 12) &&
        this.fieldMatches(dowF, now.getDay(), 0, 7)
      );
    } catch {
      return false;
    }
  }

  private fieldMatches(
    field: string,
    value: number,
    _min: number,
    _max: number,
  ): boolean {
    if (field === '*') return true;

    // Step: */n
    const stepMatch = field.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      return value % step === 0;
    }

    // Range: n-m
    const rangeMatch = field.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10);
      const hi = parseInt(rangeMatch[2], 10);
      return value >= lo && value <= hi;
    }

    // List: n,m,o
    if (field.includes(',')) {
      return field
        .split(',')
        .some((v) => this.fieldMatches(v.trim(), value, _min, _max));
    }

    // Plain number (day-of-week: 7 = Sunday = 0)
    const n = parseInt(field, 10);
    if (!isNaN(n)) {
      return n === value || (n === 7 && value === 0);
    }

    return false;
  }
}
