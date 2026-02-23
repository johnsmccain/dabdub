import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WEBHOOK = 'WEBHOOK',
}

export interface TemplateVariable {
  name: string;
  type: string;
  required: boolean;
  example: string;
}

@Entity('notification_templates')
export class NotificationTemplate extends BaseEntity {
  @Column({ unique: true })
  templateKey: string;

  @Column()
  displayName: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'text', nullable: true })
  subjectTemplate: string | null;

  @Column({ type: 'text' })
  bodyTemplate: string;

  @Column({ type: 'jsonb' })
  availableVariables: TemplateVariable[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isSystemCritical: boolean;

  @Column({ nullable: true })
  lastEditedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastEditedAt: Date | null;
}
