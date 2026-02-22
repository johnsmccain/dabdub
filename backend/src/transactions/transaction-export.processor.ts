import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Logger } from '@nestjs/common';
import { ListTransactionsQueryDto } from './dto/transaction-query.dto';

export const TRANSACTION_EXPORT_QUEUE = 'transaction-export';

export interface TransactionExportJobPayload {
  jobId: string;
  filters: ListTransactionsQueryDto;
  requestedByEmail?: string;
}

export interface TransactionExportJobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  csv?: string;
  error?: string;
  recordCount?: number;
}

const CSV_HEADER =
  'id,merchantId,txHash,chain,tokenAddress,tokenSymbol,tokenAmount,usdAmount,blockNumber,confirmations,status,feeCollectedUsd,networkFeeUsd,settlementId,flaggedForReview,failureReason,confirmedAt,settledAt,createdAt';

@Processor(TRANSACTION_EXPORT_QUEUE)
export class TransactionExportProcessor {
  private readonly logger = new Logger(TransactionExportProcessor.name);
  private readonly jobStatuses = new Map<string, TransactionExportJobStatus>();

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  @Process('generate')
  async handleExport(job: Job<TransactionExportJobPayload>): Promise<void> {
    const { jobId, filters } = job.data;
    this.logger.log(`Starting export job ${jobId}`);
    this.setJobStatus(jobId, 'processing');

    try {
      const qb = this.buildFilteredQuery(filters);
      
      // Stream results for memory efficiency
      const transactions = await qb.getMany();
      
      this.logger.log(`Export job ${jobId}: Found ${transactions.length} records`);

      const csv = this.generateCsv(transactions);
      
      this.setJobStatus(jobId, 'completed', csv, undefined, transactions.length);
      this.logger.log(`Export job ${jobId} completed successfully`);

      // TODO: Send email notification when ready
      // if (requestedByEmail) {
      //   await this.notificationService.sendEmail(requestedByEmail, 'Export ready', ...);
      // }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Export job ${jobId} failed: ${message}`, err instanceof Error ? err.stack : '');
      this.setJobStatus(jobId, 'failed', undefined, message);
      throw err;
    }
  }

  private buildFilteredQuery(filters: ListTransactionsQueryDto): SelectQueryBuilder<Transaction> {
    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.paymentRequest', 'pr');

    // Apply filters
    if (filters.merchantId) {
      qb.andWhere('pr.merchantId = :merchantId', { merchantId: filters.merchantId });
    }

    if (filters.status) {
      qb.andWhere('t.status = :status', { status: filters.status });
    }

    if (filters.chain) {
      qb.andWhere('t.network = :chain', { chain: filters.chain });
    }

    if (filters.tokenSymbol) {
      qb.andWhere('t.tokenSymbol = :tokenSymbol', { tokenSymbol: filters.tokenSymbol });
    }

    if (filters.minAmountUsd) {
      qb.andWhere('CAST(t.usdValue AS DECIMAL) >= :minAmount', {
        minAmount: parseFloat(filters.minAmountUsd),
      });
    }

    if (filters.maxAmountUsd) {
      qb.andWhere('CAST(t.usdValue AS DECIMAL) <= :maxAmount', {
        maxAmount: parseFloat(filters.maxAmountUsd),
      });
    }

    if (filters.createdAfter) {
      qb.andWhere('t.createdAt >= :createdAfter', { createdAfter: new Date(filters.createdAfter) });
    }

    if (filters.createdBefore) {
      qb.andWhere('t.createdAt <= :createdBefore', { createdBefore: new Date(filters.createdBefore) });
    }

    if (filters.flaggedOnly) {
      qb.andWhere('t.flaggedForReview = :flagged', { flagged: true });
    }

    if (filters.txHash) {
      qb.andWhere('t.txHash = :txHash', { txHash: filters.txHash });
    }

    // Order by
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    qb.orderBy(`t.${sortBy}`, sortOrder);

    return qb;
  }

  private generateCsv(transactions: Transaction[]): string {
    const escape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = transactions.map((t) => {
      const merchantId = (t.paymentRequest as any)?.merchantId || '';
      return [
        escape(t.id),
        escape(merchantId),
        escape(t.txHash),
        escape(t.network),
        escape(t.tokenAddress),
        escape(t.tokenSymbol),
        escape(t.cryptoAmount),
        escape(t.usdValue),
        escape(t.blockNumber),
        escape(t.confirmations),
        escape(t.status),
        escape(t.feeCollectedUsd),
        escape(t.networkFeeUsd),
        escape(t.settlementId),
        escape(t.flaggedForReview),
        escape(t.failureReason),
        escape(t.confirmedAt ? t.confirmedAt.toISOString() : ''),
        escape(t.settledAt ? t.settledAt.toISOString() : ''),
        escape(t.createdAt.toISOString()),
      ].join(',');
    });

    return [CSV_HEADER, ...rows].join('\n');
  }

  setJobStatus(
    jobId: string,
    status: TransactionExportJobStatus['status'],
    csv?: string,
    error?: string,
    recordCount?: number,
  ): void {
    this.jobStatuses.set(jobId, { status, csv, error, recordCount });
  }

  getJobStatus(jobId: string): TransactionExportJobStatus | undefined {
    return this.jobStatuses.get(jobId);
  }
}
