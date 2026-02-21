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

export enum FlagType {
  AML_ALERT = 'AML_ALERT',
  FRAUD_SUSPECTED = 'FRAUD_SUSPECTED',
  CHARGEBACK_RATIO_HIGH = 'CHARGEBACK_RATIO_HIGH',
  PROHIBITED_GOODS = 'PROHIBITED_GOODS',
  PEP_MATCH = 'PEP_MATCH',
  SANCTIONS_MATCH = 'SANCTIONS_MATCH',
}

export enum FlagSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity('merchant_flags')
@Index(['merchantId'])
@Index(['createdAt'])
@Index(['resolvedAt'])
export class MerchantFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'merchant_id' })
  merchantId: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({
    type: 'enum',
    enum: FlagType,
  })
  type: FlagType;

  @Column({
    type: 'enum',
    enum: FlagSeverity,
  })
  severity: FlagSeverity;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by_id', nullable: true })
  resolvedById: string | null;

  @Column({ name: 'resolution', type: 'text', nullable: true })
  resolution: string | null;
}
