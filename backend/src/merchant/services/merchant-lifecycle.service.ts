import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Merchant, MerchantStatus } from '../../database/entities/merchant.entity';
import {
  MerchantSuspension,
  SuspensionReason,
} from '../entities/merchant-suspension.entity';
import {
  MerchantTermination,
  TerminationReason,
} from '../entities/merchant-termination.entity';
import {
  MerchantFlag,
  FlagType,
  FlagSeverity,
} from '../entities/merchant-flag.entity';
import { MerchantAuditLog } from '../entities/merchant-audit-log.entity';
import { ApiKey } from '../../api-key/entities/api-key.entity';
import {
  SuspendMerchantDto,
  UnsuspendMerchantDto,
  TerminateMerchantDto,
  AddMerchantFlagDto,
  ResolveMerchantFlagDto,
  MerchantSuspensionResponseDto,
  MerchantTerminationResponseDto,
  MerchantFlagResponseDto,
} from '../dto/merchant-lifecycle.dto';
import {
  MerchantNotFoundException,
  MerchantInvalidStatusException,
} from '../exceptions/merchant.exceptions';

@Injectable()
export class MerchantLifecycleService {
  private readonly logger = new Logger(MerchantLifecycleService.name);

  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(MerchantSuspension)
    private readonly suspensionRepository: Repository<MerchantSuspension>,
    @InjectRepository(MerchantTermination)
    private readonly terminationRepository: Repository<MerchantTermination>,
    @InjectRepository(MerchantFlag)
    private readonly flagRepository: Repository<MerchantFlag>,
    @InjectRepository(MerchantAuditLog)
    private readonly auditLogRepository: Repository<MerchantAuditLog>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectQueue('settlements') private settlementsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  /**
   * Suspend a merchant account
   */
  async suspendMerchant(
    merchantId: string,
    dto: SuspendMerchantDto,
    adminId: string,
    adminEmail: string,
    adminRole: string,
  ): Promise<MerchantSuspensionResponseDto> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new MerchantNotFoundException(merchantId);
    }

    if (merchant.status !== MerchantStatus.ACTIVE) {
      throw new MerchantInvalidStatusException(
        merchant.status,
        MerchantStatus.SUSPENDED,
      );
    }

    const now = new Date();
    const autoUnsuspendAt = dto.durationHours
      ? new Date(now.getTime() + dto.durationHours * 60 * 60 * 1000)
      : null;

    // Create suspension record
    const suspension = this.suspensionRepository.create({
      merchantId,
      reason: dto.reason,
      note: dto.note,
      suspendedById: adminId,
      suspendedAt: now,
      autoUnsuspendAt,
    });

    await this.suspensionRepository.save(suspension);

    // Update merchant status
    merchant.status = MerchantStatus.SUSPENDED;
    await this.merchantRepository.save(merchant);

    // Invalidate all active API keys
    await this.apiKeyRepository.update(
      { merchantId, isActive: true },
      { isActive: false },
    );

    // Schedule auto-unsuspend job if duration provided
    if (autoUnsuspendAt) {
      const delay = autoUnsuspendAt.getTime() - now.getTime();
      await this.settlementsQueue.add(
        'auto-unsuspend-merchant',
        { merchantId, suspensionId: suspension.id },
        {
          delay,
          jobId: `auto-unsuspend-${merchantId}-${suspension.id}`,
        },
      );
      this.logger.log(
        `Scheduled auto-unsuspend for merchant ${merchantId} at ${autoUnsuspendAt.toISOString()}`,
      );
    }

    // Queue notification email
    await this.notificationsQueue.add('send-notification', {
      type: 'email',
      recipient: merchant.email,
      subject: 'Account Suspended',
      content: `Your merchant account has been suspended. Reason: ${this.getPublicSuspensionReason(dto.reason)}. Please contact support for more information.`,
      metadata: {
        merchantId,
        suspensionId: suspension.id,
        reason: dto.reason,
      },
    });

    // Create audit log
    await this.createAuditLog(
      merchantId,
      'MERCHANT_SUSPENDED',
      {
        reason: dto.reason,
        note: dto.note,
        durationHours: dto.durationHours,
        autoUnsuspendAt: autoUnsuspendAt?.toISOString(),
      },
      adminId,
      adminEmail,
      adminRole,
    );

    this.logger.log(
      `Merchant ${merchantId} suspended by ${adminEmail} for reason: ${dto.reason}`,
    );

    return MerchantSuspensionResponseDto.fromEntity(suspension);
  }

  /**
   * Unsuspend a merchant account
   */
  async unsuspendMerchant(
    merchantId: string,
    dto: UnsuspendMerchantDto,
    adminId: string,
    adminEmail: string,
    adminRole: string,
  ): Promise<MerchantSuspensionResponseDto> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new MerchantNotFoundException(merchantId);
    }

    if (merchant.status !== MerchantStatus.SUSPENDED) {
      throw new BadRequestException(
        `Merchant is not suspended. Current status: ${merchant.status}`,
      );
    }

    // Find active suspension
    const suspension = await this.suspensionRepository.findOne({
      where: { merchantId, unsuspendedAt: IsNull() },
      order: { suspendedAt: 'DESC' },
    });

    if (!suspension) {
      throw new NotFoundException('No active suspension found for this merchant');
    }

    const now = new Date();

    // Update suspension record
    suspension.unsuspendedAt = now;
    suspension.unsuspendedById = adminId;
    suspension.unsuspensionNote = dto.note;
    await this.suspensionRepository.save(suspension);

    // Update merchant status
    merchant.status = MerchantStatus.ACTIVE;
    await this.merchantRepository.save(merchant);

    // Reactivate API keys
    await this.apiKeyRepository.update(
      { merchantId },
      { isActive: true },
    );

    // Cancel pending auto-unsuspend job
    if (suspension.autoUnsuspendAt) {
      const jobId = `auto-unsuspend-${merchantId}-${suspension.id}`;
      try {
        const job = await this.settlementsQueue.getJob(jobId);
        if (job) {
          await job.remove();
          this.logger.log(`Cancelled auto-unsuspend job ${jobId}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to cancel auto-unsuspend job ${jobId}`, error);
      }
    }

    // Queue notification email
    await this.notificationsQueue.add('send-notification', {
      type: 'email',
      recipient: merchant.email,
      subject: 'Account Reactivated',
      content: 'Your merchant account has been reactivated. You can now resume normal operations.',
      metadata: {
        merchantId,
        suspensionId: suspension.id,
      },
    });

    // Create audit log
    await this.createAuditLog(
      merchantId,
      'MERCHANT_UNSUSPENDED',
      {
        suspensionId: suspension.id,
        note: dto.note,
      },
      adminId,
      adminEmail,
      adminRole,
    );

    this.logger.log(
      `Merchant ${merchantId} unsuspended by ${adminEmail}`,
    );

    return MerchantSuspensionResponseDto.fromEntity(suspension);
  }

  /**
   * Terminate a merchant account permanently
   */
  async terminateMerchant(
    merchantId: string,
    dto: TerminateMerchantDto,
    adminId: string,
    adminEmail: string,
    adminRole: string,
  ): Promise<MerchantTerminationResponseDto> {
    if (!dto.confirmed || dto.confirmed !== true) {
      throw new BadRequestException(
        'Termination must be explicitly confirmed with confirmed: true',
      );
    }

    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new MerchantNotFoundException(merchantId);
    }

    if (merchant.status === MerchantStatus.CLOSED) {
      throw new BadRequestException('Merchant is already terminated');
    }

    // Check if already terminated
    const existingTermination = await this.terminationRepository.findOne({
      where: { merchantId },
    });

    if (existingTermination) {
      throw new BadRequestException('Merchant is already terminated');
    }

    const now = new Date();

    // Create termination record
    const termination = this.terminationRepository.create({
      merchantId,
      reason: dto.reason,
      note: dto.note,
      terminatedById: adminId,
      terminatedAt: now,
    });

    await this.terminationRepository.save(termination);

    // Update merchant status
    merchant.status = MerchantStatus.CLOSED;
    merchant.closedAt = now;
    await this.merchantRepository.save(merchant);

    // Revoke ALL API keys permanently
    await this.apiKeyRepository.update(
      { merchantId },
      { isActive: false },
    );

    // Trigger final settlement run
    const settlementJob = await this.settlementsQueue.add(
      'final-settlement',
      {
        merchantId,
        terminationId: termination.id,
        reason: 'merchant_termination',
      },
      {
        priority: 1, // High priority
      },
    );

    termination.finalSettlementJobId = settlementJob.id ?? null;
    await this.terminationRepository.save(termination);

    this.logger.log(
      `Triggered final settlement job ${settlementJob.id} for merchant ${merchantId}`,
    );

    // Queue notification email with public-safe reason
    await this.notificationsQueue.add('send-notification', {
      type: 'email',
      recipient: merchant.email,
      subject: 'Account Terminated',
      content: `Your merchant account has been permanently closed. Reason: ${this.getPublicTerminationReason(dto.reason)}. A final settlement will be processed for any outstanding transactions.`,
      metadata: {
        merchantId,
        terminationId: termination.id,
        reason: dto.reason,
      },
    });

    // Create immutable audit log
    await this.createAuditLog(
      merchantId,
      'MERCHANT_TERMINATED',
      {
        reason: dto.reason,
        note: dto.note,
        finalSettlementJobId: settlementJob.id,
      },
      adminId,
      adminEmail,
      adminRole,
    );

    this.logger.warn(
      `Merchant ${merchantId} TERMINATED by ${adminEmail} for reason: ${dto.reason}`,
    );

    return MerchantTerminationResponseDto.fromEntity(termination);
  }

  /**
   * Add a compliance flag to a merchant
   */
  async addFlag(
    merchantId: string,
    dto: AddMerchantFlagDto,
    adminId: string,
    adminEmail: string,
    adminRole: string,
  ): Promise<MerchantFlagResponseDto> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new MerchantNotFoundException(merchantId);
    }

    const flag = this.flagRepository.create({
      merchantId,
      type: dto.type,
      severity: dto.severity,
      description: dto.description,
      createdById: adminId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    await this.flagRepository.save(flag);

    // Create audit log
    await this.createAuditLog(
      merchantId,
      'MERCHANT_FLAG_ADDED',
      {
        flagId: flag.id,
        type: dto.type,
        severity: dto.severity,
        description: dto.description,
        expiresAt: dto.expiresAt,
      },
      adminId,
      adminEmail,
      adminRole,
    );

    this.logger.log(
      `Flag ${dto.type} (${dto.severity}) added to merchant ${merchantId} by ${adminEmail}`,
    );

    return MerchantFlagResponseDto.fromEntity(flag);
  }

  /**
   * Get all flags for a merchant
   */
  async getFlags(merchantId: string): Promise<MerchantFlagResponseDto[]> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new MerchantNotFoundException(merchantId);
    }

    const flags = await this.flagRepository.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });

    return flags.map((flag) => MerchantFlagResponseDto.fromEntity(flag));
  }

  /**
   * Resolve a merchant flag
   */
  async resolveFlag(
    merchantId: string,
    flagId: string,
    dto: ResolveMerchantFlagDto,
    adminId: string,
    adminEmail: string,
    adminRole: string,
  ): Promise<MerchantFlagResponseDto> {
    const flag = await this.flagRepository.findOne({
      where: { id: flagId, merchantId },
    });

    if (!flag) {
      throw new NotFoundException('Flag not found');
    }

    if (flag.resolvedAt) {
      throw new BadRequestException('Flag is already resolved');
    }

    flag.resolvedAt = new Date();
    flag.resolvedById = adminId;
    flag.resolution = dto.resolution;

    await this.flagRepository.save(flag);

    // Create audit log
    await this.createAuditLog(
      merchantId,
      'MERCHANT_FLAG_RESOLVED',
      {
        flagId: flag.id,
        type: flag.type,
        resolution: dto.resolution,
      },
      adminId,
      adminEmail,
      adminRole,
    );

    this.logger.log(
      `Flag ${flagId} resolved for merchant ${merchantId} by ${adminEmail}`,
    );

    return MerchantFlagResponseDto.fromEntity(flag);
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

  /**
   * Get public-safe suspension reason
   */
  private getPublicSuspensionReason(reason: SuspensionReason): string {
    const reasonMap: Record<SuspensionReason, string> = {
      [SuspensionReason.FRAUD_INVESTIGATION]: 'Account under review',
      [SuspensionReason.AML_REVIEW]: 'Compliance review in progress',
      [SuspensionReason.CHARGEBACK_THRESHOLD]: 'Account review required',
      [SuspensionReason.POLICY_VIOLATION]: 'Terms of service violation',
      [SuspensionReason.MANUAL]: 'Administrative review',
    };

    return reasonMap[reason] || 'Account suspended';
  }

  /**
   * Get public-safe termination reason
   */
  private getPublicTerminationReason(reason: TerminationReason): string {
    const reasonMap: Record<TerminationReason, string> = {
      [TerminationReason.FRAUD_CONFIRMED]: 'Terms of service violation',
      [TerminationReason.AML_VIOLATION]: 'Compliance violation',
      [TerminationReason.REPEATED_POLICY_VIOLATIONS]: 'Terms of service violation',
      [TerminationReason.MERCHANT_REQUEST]: 'Account closed per your request',
      [TerminationReason.OTHER]: 'Account closed',
    };

    return reasonMap[reason] || 'Account terminated';
  }
}
