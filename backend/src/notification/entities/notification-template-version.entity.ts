import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';

@Entity('notification_template_versions')
export class NotificationTemplateVersion extends BaseEntity {
  @Column()
  templateKey: string;

  @Column({ type: 'text', nullable: true })
  subjectTemplate: string | null;

  @Column({ type: 'text' })
  bodyTemplate: string;

  @Column()
  editedById: string;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, unknown> | null;
}
