import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExportFormat, ExportResourceType, ExportStatus } from '../enums/export.enums';

@Entity('export_jobs')
export class ExportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  adminId: string;

  @Column({ type: 'enum', enum: ExportResourceType })
  resourceType: ExportResourceType;

  @Column({ type: 'jsonb' })
  filters: Record<string, unknown>;

  @Column({ type: 'enum', enum: ExportFormat })
  format: ExportFormat;

  @Column({ type: 'enum', enum: ExportStatus, default: ExportStatus.QUEUED })
  status: ExportStatus;

  @Column({ type: 'int', nullable: true })
  estimatedRowCount: number | null;

  @Column({ type: 'int', nullable: true })
  actualRowCount: number | null;

  @Column({ nullable: true })
  s3Key: string | null;

  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes: number | null;

  @Column({ type: 'int', default: 0 })
  progressPercentage: number;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
