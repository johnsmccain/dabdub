import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';

export enum DeliveryStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
}

@Entity('notification_deliveries')
export class NotificationDelivery extends BaseEntity {
  @Column()
  templateKey: string;

  @Column()
  channel: string;

  @Column({ nullable: true })
  recipientEmail: string | null;

  @Column({ nullable: true })
  recipientPhone: string | null;

  @Column({ nullable: true })
  merchantId: string | null;

  @Column({ type: 'jsonb' })
  variables: Record<string, unknown>;

  @Column({ type: 'enum', enum: DeliveryStatus })
  status: DeliveryStatus;

  @Column({ type: 'text', nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
}
