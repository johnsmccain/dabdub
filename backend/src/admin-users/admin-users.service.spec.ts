import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminUser, AdminRole, AdminStatus } from '../database/entities/admin-user.entity';
import { AdminUsersService } from './admin-users.service';
import { PasswordService } from '../auth/services/password.service';
import { CacheService } from '../cache/cache.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let adminUserRepo: jest.Mocked<Repository<AdminUser>>;
  let auditLogService: jest.Mocked<AuditLogService>;

  const mockAdminUser = (overrides: Partial<AdminUser> = {}): AdminUser =>
    ({
      id: 'admin-1',
      email: 'admin@cheese.io',
      firstName: 'Jane',
      lastName: 'Doe',
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      customPermissions: [],
      revokedPermissions: [],
      mustChangePassword: false,
      twoFactorEnabled: false,
      createdById: null,
      createdBy: null,
      deletedAt: null,
      ...overrides,
    }) as AdminUser;

  beforeEach(async () => {
    const mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        getCount: jest.fn().mockResolvedValue(1),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
      }),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || 'new-id' })),
      findOne: jest.fn(),
      count: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: getRepositoryToken(AdminUser), useValue: mockRepo },
        {
          provide: PasswordService,
          useValue: { hashPasswordForAdmin: jest.fn().mockResolvedValue('hashed') },
        },
        {
          provide: CacheService,
          useValue: {
            delPattern: jest.fn().mockResolvedValue(0),
            hgetall: jest.fn().mockResolvedValue(null),
            hdel: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue({}), search: jest.fn().mockResolvedValue({ data: [], total: 0 }) },
        },
      ],
    }).compile();

    service = module.get(AdminUsersService);
    adminUserRepo = module.get(getRepositoryToken(AdminUser));
    auditLogService = module.get(AuditLogService);
  });

  describe('create', () => {
    it('should throw ConflictException when email already exists', async () => {
      (adminUserRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAdminUser({ email: 'existing@cheese.io' })),
      });

      const dto: CreateAdminUserDto = {
        email: 'existing@cheese.io',
        firstName: 'John',
        lastName: 'Smith',
        role: AdminRole.SUPPORT_ADMIN,
      };

      await expect(service.create(dto, 'creator-id')).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException when admin tries to change own role', async () => {
      const admin = mockAdminUser({ id: 'self-id', role: AdminRole.SUPER_ADMIN });
      (adminUserRepo.findOne as jest.Mock).mockResolvedValue(admin);
      (adminUserRepo.count as jest.Mock).mockResolvedValue(2);

      const dto: UpdateAdminUserDto = { role: AdminRole.READONLY_ADMIN };

      await expect(service.update('self-id', dto, 'self-id', AdminRole.SUPER_ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when demoting the last SUPER_ADMIN', async () => {
      const admin = mockAdminUser({ id: 'last-super', role: AdminRole.SUPER_ADMIN });
      (adminUserRepo.findOne as jest.Mock).mockResolvedValue(admin);
      (adminUserRepo.count as jest.Mock).mockResolvedValue(1);

      const dto: UpdateAdminUserDto = { role: AdminRole.SUPPORT_ADMIN };

      await expect(
        service.update('last-super', dto, 'other-admin-id', AdminRole.SUPER_ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should throw ForbiddenException when deleting self', async () => {
      await expect(service.remove('self-id', 'self-id')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when deleting the last SUPER_ADMIN', async () => {
      const admin = mockAdminUser({ id: 'last-super', role: AdminRole.SUPER_ADMIN });
      (adminUserRepo.findOne as jest.Mock).mockResolvedValue(admin);
      (adminUserRepo.count as jest.Mock).mockResolvedValue(1);

      await expect(service.remove('last-super', 'other-admin-id')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when admin does not exist', async () => {
      (adminUserRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('non-existent', 'admin-id')).rejects.toThrow(NotFoundException);
    });
  });
});
