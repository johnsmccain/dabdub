import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SavedReport } from './saved-report.entity';
import { BaseEntity } from 'src/database/entities/base.entity';
import { ExportFormat } from 'src/Data export/export.enums';
import { ReportRunStatus } from '../enums/report.enums';

@Entity('report_runs')
@Index(['reportId'])
@Index(['status'])
@Index(['createdAt'])
export class ReportRun extends BaseEntity {
  @Column({ type: 'uuid' })
  reportId: string;

  @ManyToOne(() => SavedReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportId' })
  report: SavedReport;

  @Column({
    type: 'enum',
    enum: ReportRunStatus,
    default: ReportRunStatus.PENDING,
  })
  status: ReportRunStatus;

  @Column({ type: 'enum', enum: ExportFormat })
  format: ExportFormat;

  @Column({ type: 'uuid', nullable: true })
  triggeredById: string | null;

  /** Populated when status = COMPLETED */
  @Column({ type: 'int', nullable: true })
  rowCount: number | null;

  /** Size in bytes of generated file */
  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes: number | null;

  /** Signed / public download URL — expires after 24 h */
  @Column({ type: 'text', nullable: true })
  downloadUrl: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fileExpiresAt: Date | null;

  /** Bull job ID for status polling */
  @Column({ type: 'varchar', nullable: true })
  jobId: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  /** true if triggered by scheduler, false if manual */
  @Column({ type: 'boolean', default: false })
  isScheduled: boolean;
}
