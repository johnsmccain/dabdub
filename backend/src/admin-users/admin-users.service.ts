import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser, AdminRole, AdminStatus } from '../database/entities/admin-user.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction, ActorType, DataClassification } from '../database/entities/audit-log.enums';
import { PasswordService } from '../auth/services/password.service';
import { CacheService } from '../cache/cache.service';
import { PaginationMetaDto } from '../common/dto/pagination.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { getEffectivePermissions } from './constants/permissions';

const TEMP_PASSWORD_LENGTH = 16;
const PASSWORD_HISTORY_SIZE = 5;

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
    private readonly passwordService: PasswordService,
    private readonly cacheService: CacheService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Generate a secure temporary password: 16 chars with upper, lower, digit, special. */
  generateTemporaryPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digit = '23456789';
    const special = '@$!%*?&';
    const all = upper + lower + digit + special;
    let s = '';
    s += upper[Math.floor(Math.random() * upper.length)];
    s += lower[Math.floor(Math.random() * lower.length)];
    s += digit[Math.floor(Math.random() * digit.length)];
    s += special[Math.floor(Math.random() * special.length)];
    for (let i = s.length; i < TEMP_PASSWORD_LENGTH; i++) {
      s += all[Math.floor(Math.random() * all.length)];
    }
    return s.split('').sort(() => Math.random() - 0.5).join('');
  }

  /** Revoke all active sessions for an admin (Redis). */
  async revokeAllSessionsForAdmin(adminId: string): Promise<void> {
    const pattern = `auth:refresh:admin_v1:${adminId}:*`;
    await this.cacheService.delPattern(pattern);
    const sessionKey = `auth:sessions:admin_v1:${adminId}`;
    const sessions = await this.cacheService.hgetall(sessionKey);
    if (sessions) {
      for (const field of Object.keys(sessions)) {
        await this.cacheService.hdel(sessionKey, field);
      }
    }
    this.logger.log(`Revoked all sessions for admin ${adminId}`);
  }

  async create(
    dto: CreateAdminUserDto,
    currentAdminId: string,
    actorType: ActorType = ActorType.ADMIN,
  ): Promise<AdminUser> {
    const existing = await this.adminUserRepo
      .createQueryBuilder('a')
      .where('LOWER(a.email) = LOWER(:email)', { email: dto.email })
      .getOne();
    if (existing) {
      throw new ConflictException('An admin user with this email already exists');
    }

    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await this.passwordService.hashPasswordForAdmin(tempPassword);

    const admin = this.adminUserRepo.create({
      email: dto.email.trim().toLowerCase(),
      passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      role: dto.role,
      status: AdminStatus.ACTIVE,
      customPermissions: dto.customPermissions ?? [],
      revokedPermissions: [],
      mustChangePassword: true,
      phoneNumber: dto.phoneNumber ?? null,
      createdById: currentAdminId,
    });
    const saved = await this.adminUserRepo.save(admin);

    await this.auditLogService.log({
      entityType: 'AdminUser',
      entityId: saved.id,
      action: AuditAction.ADMIN_USER_CREATED,
      actorId: currentAdminId,
      actorType,
      afterState: {
        email: saved.email,
        role: saved.role,
        status: saved.status,
      },
      dataClassification: DataClassification.SENSITIVE,
    });

    this.queueWelcomeEmail(saved.email, tempPassword).catch((err) =>
      this.logger.warn('Welcome email queue failed', err),
    );

    return saved;
  }

  async findAll(
    query: ListAdminUsersQueryDto,
  ): Promise<{ data: AdminUser[]; meta: PaginationMetaDto }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = (query.sortOrder ?? 'DESC') as 'ASC' | 'DESC';

    const qb = this.adminUserRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.createdBy', 'createdBy')
      .where('a.deletedAt IS NULL');

    if (query.role) qb.andWhere('a.role = :role', { role: query.role });
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.search) {
      const term = `%${query.search}%`;
      qb.andWhere(
        '(LOWER(a.email) LIKE LOWER(:term) OR LOWER(a.firstName) LIKE LOWER(:term) OR LOWER(a.lastName) LIKE LOWER(:term))',
        { term },
      );
    }
    if (query.createdAfter) {
      qb.andWhere('a.createdAt >= :createdAfter', { createdAfter: query.createdAfter });
    }
    if (query.createdBefore) {
      qb.andWhere('a.createdAt <= :createdBefore', { createdBefore: query.createdBefore });
    }

    const total = await qb.getCount();
    qb.orderBy(`a.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const data = await qb.getMany();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: { total, page, limit, totalPages },
    };
  }

  async findOneByEmail(email: string): Promise<AdminUser | null> {
    return this.adminUserRepo
      .createQueryBuilder('a')
      .where('LOWER(a.email) = LOWER(:email)', { email })
      .andWhere('a.deletedAt IS NULL')
      .getOne();
  }

  async findOne(id: string): Promise<AdminUser> {
    const admin = await this.adminUserRepo.findOne({
      where: { id, deletedAt: null as any },
      relations: ['createdBy'],
    });
    if (!admin) throw new NotFoundException('Admin user not found');
    return admin;
  }

  async findOneWithDetail(id: string): Promise<{
    admin: AdminUser;
    activeSessionCount: number;
    loginHistory: { createdAt: Date; ipAddress: string | null; userAgent: string | null }[];
    recentAuditActions: { action: string; createdAt: Date }[];
  }> {
    const admin = await this.findOne(id);

    let activeSessionCount = 0;
    const sessionKey = `auth:sessions:admin_v1:${id}`;
    const sessions = await this.cacheService.hgetall(sessionKey);
    if (sessions) activeSessionCount = Object.keys(sessions).length;

    const auditSearch = await this.auditLogService.search({
      entityType: 'AdminUser',
      entityId: id,
      limit: 20,
    });
    const loginHistory = auditSearch.data
      .filter((e) => e.action === AuditAction.ADMIN_LOGIN)
      .slice(0, 10)
      .map((e) => ({
        createdAt: e.createdAt,
        ipAddress: e.ipAddress ?? null,
        userAgent: e.userAgent ?? null,
      }));
    const recentAuditActions = auditSearch.data.slice(0, 5).map((e) => ({
      action: e.action,
      createdAt: e.createdAt,
    }));

    return {
      admin,
      activeSessionCount,
      loginHistory,
      recentAuditActions,
    };
  }

  async update(
    id: string,
    dto: UpdateAdminUserDto,
    currentAdminId: string,
    currentAdminRole: AdminRole | string,
  ): Promise<AdminUser> {
    const admin = await this.adminUserRepo.findOne({
      where: { id, deletedAt: null as any },
      relations: ['createdBy'],
    });
    if (!admin) throw new NotFoundException('Admin user not found');

    if (currentAdminId === id) {
      if (dto.role !== undefined || dto.status !== undefined) {
        throw new ForbiddenException('You cannot change your own role or status');
      }
    }

    const superAdminCount = await this.adminUserRepo.count({
      where: { role: AdminRole.SUPER_ADMIN, deletedAt: null as any },
    });
    if (admin.role === AdminRole.SUPER_ADMIN && superAdminCount <= 1) {
      if (dto.role !== undefined && dto.role !== AdminRole.SUPER_ADMIN) {
        throw new ForbiddenException('Cannot demote the last SUPER_ADMIN');
      }
    }

    if (dto.status === AdminStatus.ACTIVE && admin.status === AdminStatus.LOCKED && admin.lockedUntil) {
      if (new Date() < admin.lockedUntil) {
        throw new BadRequestException('Cannot set status to ACTIVE while account is locked');
      }
    }

    const beforeState = {
      role: admin.role,
      status: admin.status,
      firstName: admin.firstName,
      lastName: admin.lastName,
      customPermissions: [...(admin.customPermissions ?? [])],
      revokedPermissions: [...(admin.revokedPermissions ?? [])],
    };

    if (dto.firstName !== undefined) admin.firstName = dto.firstName;
    if (dto.lastName !== undefined) admin.lastName = dto.lastName;
    if (dto.role !== undefined) admin.role = dto.role;
    if (dto.status !== undefined) admin.status = dto.status;
    if (dto.customPermissions !== undefined) admin.customPermissions = dto.customPermissions;
    if (dto.revokedPermissions !== undefined) admin.revokedPermissions = dto.revokedPermissions;

    const roleChanged = beforeState.role !== admin.role;
    if (roleChanged) {
      await this.revokeAllSessionsForAdmin(admin.id);
    }

    const saved = await this.adminUserRepo.save(admin);

    const afterState = {
      role: saved.role,
      status: saved.status,
      firstName: saved.firstName,
      lastName: saved.lastName,
      customPermissions: saved.customPermissions,
      revokedPermissions: saved.revokedPermissions,
    };

    await this.auditLogService.log({
      entityType: 'AdminUser',
      entityId: saved.id,
      action: AuditAction.ADMIN_USER_UPDATED,
      actorId: currentAdminId,
      actorType: ActorType.ADMIN,
      beforeState,
      afterState,
      dataClassification: DataClassification.SENSITIVE,
    });

    return saved;
  }

  async remove(id: string, currentAdminId: string): Promise<void> {
    if (currentAdminId === id) {
      throw new ForbiddenException('You cannot delete yourself');
    }

    const admin = await this.adminUserRepo.findOne({
      where: { id, deletedAt: null as any },
    });
    if (!admin) throw new NotFoundException('Admin user not found');

    const superAdminCount = await this.adminUserRepo.count({
      where: { role: AdminRole.SUPER_ADMIN, deletedAt: null as any },
    });
    if (admin.role === AdminRole.SUPER_ADMIN && superAdminCount <= 1) {
      throw new ForbiddenException('Cannot delete the last SUPER_ADMIN');
    }

    await this.revokeAllSessionsForAdmin(admin.id);
    admin.deletedAt = new Date();
    await this.adminUserRepo.save(admin);

    await this.auditLogService.log({
      entityType: 'AdminUser',
      entityId: admin.id,
      action: AuditAction.ADMIN_USER_DELETED,
      actorId: currentAdminId,
      actorType: ActorType.ADMIN,
      beforeState: { email: admin.email, role: admin.role },
      dataClassification: DataClassification.SENSITIVE,
    });
  }

  async resetPassword(id: string, currentAdminId: string): Promise<{ temporaryPassword: string }> {
    const admin = await this.adminUserRepo.findOne({
      where: { id, deletedAt: null as any },
    });
    if (!admin) throw new NotFoundException('Admin user not found');

    const tempPassword = this.generateTemporaryPassword();
    admin.passwordHash = await this.passwordService.hashPasswordForAdmin(tempPassword);
    admin.mustChangePassword = true;
    admin.passwordHistory = admin.passwordHistory ?? [];
    await this.adminUserRepo.save(admin);

    await this.revokeAllSessionsForAdmin(admin.id);

    await this.auditLogService.log({
      entityType: 'AdminUser',
      entityId: admin.id,
      action: AuditAction.ADMIN_PASSWORD_RESET,
      actorId: currentAdminId,
      actorType: ActorType.ADMIN,
      dataClassification: DataClassification.SENSITIVE,
    });

    this.sendPasswordResetEmail(admin.email, tempPassword).catch((err) =>
      this.logger.warn('Password reset email failed', err),
    );

    return { temporaryPassword: tempPassword };
  }

  /** Revoke all sessions for admin except the current one. */
  async revokeAllSessionsExcept(adminId: string, currentSessionId: string): Promise<void> {
    const sessionKey = `auth:sessions:admin_v1:${adminId}`;
    const sessions = await this.cacheService.hgetall(sessionKey);
    if (sessions) {
      for (const sessionId of Object.keys(sessions)) {
        if (sessionId !== currentSessionId) {
          await this.cacheService.del(`auth:refresh:admin_v1:${adminId}:${sessionId}`);
          await this.cacheService.hdel(sessionKey, sessionId);
        }
      }
    }
  }

  /** Change own password (authenticated admin). */
  async changeOwnPassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string,
    currentSessionId: string | undefined,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }

    const admin = await this.adminUserRepo
      .createQueryBuilder('a')
      .addSelect('a.passwordHash')
      .addSelect('a.passwordHistory')
      .where('a.id = :id', { id: adminId })
      .andWhere('a.deletedAt IS NULL')
      .getOne();

    if (!admin) throw new NotFoundException('Admin user not found');

    const valid = await this.passwordService.comparePassword(
      currentPassword,
      admin.passwordHash,
    );
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const history: string[] = Array.isArray(admin.passwordHistory) ? admin.passwordHistory : [];
    const newHash = await this.passwordService.hashPasswordForAdmin(newPassword);
    for (const h of history) {
      const match = await this.passwordService.comparePassword(newPassword, h);
      if (match) throw new BadRequestException('New password must not match any of your last 5 passwords');
    }

    const newHistory = [newHash, ...history].slice(0, PASSWORD_HISTORY_SIZE);
    admin.passwordHash = newHash;
    admin.passwordChangedAt = new Date();
    admin.mustChangePassword = false;
    admin.passwordHistory = newHistory;
    await this.adminUserRepo.save(admin);

    if (currentSessionId) {
      await this.revokeAllSessionsExcept(adminId, currentSessionId);
    } else {
      await this.revokeAllSessionsForAdmin(adminId);
    }

    await this.auditLogService.log({
      entityType: 'AdminUser',
      entityId: adminId,
      action: AuditAction.ADMIN_PASSWORD_CHANGED,
      actorId: adminId,
      actorType: ActorType.ADMIN,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      dataClassification: DataClassification.SENSITIVE,
    });
  }

  private async queueWelcomeEmail(email: string, temporaryPassword: string): Promise<void> {
    this.logger.log(`Welcome email would be sent to ${email} with temporary password (not persisted)`);
  }

  private async sendPasswordResetEmail(email: string, temporaryPassword: string): Promise<void> {
    this.logger.log(`Password reset email would be sent to ${email}`);
  }
}
