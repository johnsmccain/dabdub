import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Merchant } from '../../database/entities/merchant.entity';

export enum SuspensionReason {
  FRAUD_INVESTIGATION = 'FRAUD_INVESTIGATION',
  AML_REVIEW = 'AML_REVIEW',
  CHARGEBACK_THRESHOLD = 'CHARGEBACK_THRESHOLD',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  MANUAL = 'MANUAL',
}

@Entity('merchant_suspensions')
@Index(['merchantId'])
@Index(['suspendedAt'])
export class MerchantSuspension {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({
    type: 'enum',
    enum: SuspensionReason,
  })
  reason: SuspensionReason;

  @Column({ type: 'text' })
  note: string;

  @Column({ name: 'suspended_by_id', nullable: true })
  suspendedById: string;

  @Column({ name: 'suspended_at', type: 'timestamptz' })
  suspendedAt: Date;

  @Column({ name: 'auto_unsuspend_at', type: 'timestamptz', nullable: true })
  autoUnsuspendAt: Date | null;

  @Column({ name: 'unsuspended_at', type: 'timestamptz', nullable: true })
  unsuspendedAt: Date | null;

  @Column({ name: 'unsuspended_by_id', nullable: true })
  unsuspendedById: string | null;

  @Column({ name: 'unsuspension_note', type: 'text', nullable: true })
  unsuspensionNote: string | null;
}
