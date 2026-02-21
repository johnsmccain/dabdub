import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Merchant } from '../../database/entities/merchant.entity';

export enum TerminationReason {
  FRAUD_CONFIRMED = 'FRAUD_CONFIRMED',
  AML_VIOLATION = 'AML_VIOLATION',
  REPEATED_POLICY_VIOLATIONS = 'REPEATED_POLICY_VIOLATIONS',
  MERCHANT_REQUEST = 'MERCHANT_REQUEST',
  OTHER = 'OTHER',
}

@Entity('merchant_terminations')
@Index(['merchantId'], { unique: true })
@Index(['terminatedAt'])
export class MerchantTermination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id', unique: true })
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({
    type: 'enum',
    enum: TerminationReason,
  })
  reason: TerminationReason;

  @Column({ type: 'text' })
  note: string;

  @Column({ name: 'terminated_by_id' })
  terminatedById: string;

  @Column({ name: 'terminated_at', type: 'timestamptz' })
  terminatedAt: Date;

  @Column({ name: 'final_settlement_job_id', nullable: true })
  finalSettlementJobId: string | null;

  @Column({ name: 'final_settlement_completed_at', type: 'timestamptz', nullable: true })
  finalSettlementCompletedAt: Date | null;
}
