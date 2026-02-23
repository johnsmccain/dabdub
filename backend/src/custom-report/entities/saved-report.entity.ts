import { BaseEntity } from 'src/database/entities/base.entity';
import { Entity, Column, Index } from 'typeorm';
import {
  ExportFormat,
  ReportColumn,
  ReportDataSource,
  ReportFilter,
  ReportSort,
} from '../enums/report.enums';

@Entity('saved_reports')
@Index(['createdById'])
@Index(['dataSource'])
@Index(['isShared'])
@Index(['isScheduled'])
export class SavedReport extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ReportDataSource })
  dataSource: ReportDataSource;

  @Column({ type: 'jsonb' })
  columns: ReportColumn[];

  @Column({ type: 'jsonb', default: [] })
  filters: ReportFilter[];

  @Column({ type: 'jsonb', default: [] })
  sorting: ReportSort[];

  @Column({ type: 'boolean', default: false })
  isScheduled: boolean;

  /** Cron expression, e.g. '0 9 * * 1' (every Monday 9 am) */
  @Column({ type: 'varchar', nullable: true })
  scheduleExpression: string | null;

  @Column({ type: 'jsonb', default: [] })
  scheduleRecipientEmails: string[];

  @Column({ type: 'enum', enum: ExportFormat, default: ExportFormat.CSV })
  defaultFormat: ExportFormat;

  @Column({ type: 'uuid' })
  createdById: string;

  /** true → visible to all admins with analytics:read */
  @Column({ type: 'boolean', default: false })
  isShared: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @Column({ type: 'int', default: 0 })
  runCount: number;
}
