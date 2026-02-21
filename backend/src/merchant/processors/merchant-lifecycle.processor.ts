import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Merchant, MerchantStatus } from '../../database/entities/merchant.entity';
import { MerchantSuspension } from '../entities/merchant-suspension.entity';
import { MerchantAuditLog } from '../entities/merchant-audit-log.entity';
import { ApiKey } from '../../api-key/entities/api-key.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Processor('settlements')
export class MerchantLifecycleProcessor extends WorkerHost {
  private readonly logger = new Logger(MerchantLifecycleProcessor.name);

  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(MerchantSuspension)
    private readonly suspensionRepository: Repository<MerchantSuspension>,
    @InjectRepository(MerchantAuditLog)
    private readonly auditLogRepository: Repository<MerchantAuditLog>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    switch (job.name) {
      case 'auto-unsuspend-merchant':
        return this.handleAutoUnsuspend(job);
      case 'final-settlement':
        return this.handleFinalSettlement(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  /**
   * Handle automatic unsuspension of merchant
   */
  private async handleAutoUnsuspend(
    job: Job<{ merchantId: string; suspensionId: string }>,
  ): Promise<void> {
    const { merchantId, suspensionId } = job.data;
    this.logger.log(`Processing auto-unsuspend for merchant ${merchantId}`);

    try {
      const merchant = await this.merchantRepository.findOne({
        where: { id: merchantId },
      });

      if (!merchant) {
        this.logger.error(`Merchant ${merchantId} not found`);
        return;
      }

      if (merchant.status !== MerchantStatus.SUSPENDED) {
        this.logger.warn(
          `Merchant ${merchantId} is not suspended. Current status: ${merchant.status}`,
        );
        return;
      }

      const suspension = await this.suspensionRepository.findOne({
        where: { id: suspensionId, merchantId, unsuspendedAt: IsNull() },
      });

      if (!suspension) {
        this.logger.warn(
          `Active suspension ${suspensionId} not found for merchant ${merchantId}`,
        );
        return;
      }

      const now = new Date();

      // Update suspension record
      suspension.unsuspendedAt = now;
      suspension.unsuspendedById = 'system';
      suspension.unsuspensionNote = 'Automatically unsuspended after scheduled duration';
      await this.suspensionRepository.save(suspension);

      // Update merchant status
      merchant.status = MerchantStatus.ACTIVE;
      merchant.suspendedAt = null;
      await this.merchantRepository.save(merchant);

      // Reactivate API keys
      await this.apiKeyRepository.update(
        { merchantId },
        { isActive: true },
      );

      // Queue notification email
      await this.notificationsQueue.add('send-notification', {
        type: 'email',
        recipient: merchant.email,
        subject: 'Account Automatically Reactivated',
        content:
          'Your merchant account suspension period has ended and your account has been automatically reactivated.',
        metadata: {
          merchantId,
          suspensionId,
          autoUnsuspend: true,
        },
      });

      // Create audit log
      await this.createAuditLog(
        merchantId,
        'MERCHANT_AUTO_UNSUSPENDED',
        {
          suspensionId,
          scheduledAt: suspension.autoUnsuspendAt?.toISOString(),
        },
        'system',
        'system@auto-unsuspend',
        'SYSTEM',
      );

      this.logger.log(
        `Merchant ${merchantId} automatically unsuspended successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to auto-unsuspend merchant ${merchantId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle final settlement for terminated merchant
   */
  private async handleFinalSettlement(
    job: Job<{ merchantId: string; terminationId: string; reason: string }>,
  ): Promise<any> {
    const { merchantId, terminationId, reason } = job.data;
    this.logger.log(`Processing final settlement for merchant ${merchantId}`);

    try {
      // This is a placeholder for the actual settlement logic
      // In a real implementation, this would:
      // 1. Find all confirmed, unsettled transactions
      // 2. Calculate final settlement amount
      // 3. Process settlement to merchant's bank account
      // 4. Update transaction statuses
      // 5. Generate final settlement report

      // Simulate settlement processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create audit log
      await this.createAuditLog(
        merchantId,
        'FINAL_SETTLEMENT_COMPLETED',
        {
          terminationId,
          reason,
          jobId: job.id,
        },
        'system',
        'system@final-settlement',
        'SYSTEM',
      );

      this.logger.log(
        `Final settlement completed for merchant ${merchantId}`,
      );

      return {
        success: true,
        merchantId,
        terminationId,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to process final settlement for merchant ${merchantId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    merchantId: string,
    action: string,
    changes: Record<string, any>,
    adminId: string,
    adminEmail: string,
    adminRole: string,
  ): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      merchantId,
      action,
      changes,
      changedBy: {
        id: adminId,
        email: adminEmail,
        role: adminRole,
      },
    });

    await this.auditLogRepository.save(auditLog);
  }
}
