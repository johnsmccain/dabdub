import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationTemplate, NotificationChannel } from './entities/notification-template.entity';
import { NotificationTemplateVersion } from './entities/notification-template-version.entity';
import { NotificationDelivery, DeliveryStatus } from './entities/notification-delivery.entity';

describe('NotificationTemplateService', () => {
  let service: NotificationTemplateService;
  let templateRepo: Repository<NotificationTemplate>;
  let versionRepo: Repository<NotificationTemplateVersion>;
  let deliveryRepo: Repository<NotificationDelivery>;
  let cacheManager: any;

  const mockTemplate: NotificationTemplate = {
    id: '1',
    templateKey: 'merchant.kyc.approved',
    displayName: 'KYC Approved',
    channel: NotificationChannel.EMAIL,
    subjectTemplate: 'Welcome {{merchant.businessName}}',
    bodyTemplate: 'Hello {{merchant.businessName}}, your account is approved.',
    availableVariables: [
      { name: 'merchant.businessName', type: 'string', required: true, example: 'Acme Corp' },
    ],
    isActive: true,
    isSystemCritical: false,
    lastEditedById: null,
    lastEditedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationTemplateService,
        {
          provide: getRepositoryToken(NotificationTemplate),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(NotificationTemplateVersion),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(NotificationDelivery),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationTemplateService>(NotificationTemplateService);
    templateRepo = module.get(getRepositoryToken(NotificationTemplate));
    versionRepo = module.get(getRepositoryToken(NotificationTemplateVersion));
    deliveryRepo = module.get(getRepositoryToken(NotificationDelivery));
    cacheManager = module.get(CACHE_MANAGER);
  });

  describe('validateTemplate', () => {
    it('should reject invalid Handlebars syntax', async () => {
      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(mockTemplate);

      await expect(
        service.update('merchant.kyc.approved', { bodyTemplate: '{{unclosed' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject variables not in availableVariables', async () => {
      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(mockTemplate);

      await expect(
        service.update('merchant.kyc.approved', { bodyTemplate: 'Hello {{invalid.variable}}' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid template with available variables', async () => {
      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(mockTemplate);
      jest.spyOn(templateRepo, 'save').mockResolvedValue(mockTemplate);
      jest.spyOn(versionRepo, 'create').mockReturnValue({} as any);
      jest.spyOn(versionRepo, 'save').mockResolvedValue({} as any);
      jest.spyOn(versionRepo, 'find').mockResolvedValue([]);

      const result = await service.update(
        'merchant.kyc.approved',
        { bodyTemplate: 'Hello {{merchant.businessName}}' },
        'admin-1',
      );

      expect(result).toBeDefined();
    });
  });

  describe('system-critical guard', () => {
    it('should prevent disabling system-critical templates', async () => {
      const criticalTemplate = { ...mockTemplate, isSystemCritical: true };
      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(criticalTemplate);

      await expect(
        service.update('merchant.kyc.approved', { isActive: false }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow disabling non-critical templates', async () => {
      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(mockTemplate);
      jest.spyOn(templateRepo, 'save').mockResolvedValue({ ...mockTemplate, isActive: false });
      jest.spyOn(versionRepo, 'create').mockReturnValue({} as any);
      jest.spyOn(versionRepo, 'save').mockResolvedValue({} as any);
      jest.spyOn(versionRepo, 'find').mockResolvedValue([]);

      const result = await service.update('merchant.kyc.approved', { isActive: false }, 'admin-1');

      expect(result.isActive).toBe(false);
    });
  });

  describe('version rollback', () => {
    it('should rollback to previous version', async () => {
      const version: NotificationTemplateVersion = {
        id: 'v1',
        templateKey: 'merchant.kyc.approved',
        subjectTemplate: 'Old Subject',
        bodyTemplate: 'Old Body',
        editedById: 'admin-0',
        changes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(mockTemplate);
      jest.spyOn(versionRepo, 'findOne').mockResolvedValue(version);
      jest.spyOn(versionRepo, 'create').mockReturnValue({} as any);
      jest.spyOn(versionRepo, 'save').mockResolvedValue({} as any);
      jest.spyOn(versionRepo, 'find').mockResolvedValue([]);
      jest.spyOn(templateRepo, 'save').mockResolvedValue({
        ...mockTemplate,
        bodyTemplate: 'Old Body',
        subjectTemplate: 'Old Subject',
      });

      const result = await service.rollback('merchant.kyc.approved', 'v1', 'admin-1');

      expect(result.bodyTemplate).toBe('Old Body');
      expect(result.subjectTemplate).toBe('Old Subject');
    });

    it('should throw NotFoundException for invalid version', async () => {
      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(mockTemplate);
      jest.spyOn(versionRepo, 'findOne').mockResolvedValue(null);

      await expect(service.rollback('merchant.kyc.approved', 'invalid', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('version history', () => {
    it('should keep only last 10 versions', async () => {
      const versions = Array.from({ length: 12 }, (_, i) => ({
        id: `v${i}`,
        templateKey: 'merchant.kyc.approved',
        createdAt: new Date(Date.now() - i * 1000),
      }));

      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(mockTemplate);
      jest.spyOn(versionRepo, 'create').mockReturnValue({} as any);
      jest.spyOn(versionRepo, 'save').mockResolvedValue({} as any);
      jest.spyOn(versionRepo, 'find').mockResolvedValue(versions as any);
      jest.spyOn(versionRepo, 'remove').mockResolvedValue([] as any);
      jest.spyOn(templateRepo, 'save').mockResolvedValue(mockTemplate);

      await service.update('merchant.kyc.approved', { bodyTemplate: 'New body content' }, 'admin-1');

      expect(versionRepo.remove).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'v10' })]));
    });
  });

  describe('preview', () => {
    it('should render template with provided variables', async () => {
      jest.spyOn(templateRepo, 'findOne').mockResolvedValue(mockTemplate);

      const result = await service.preview('merchant.kyc.approved', {
        merchant: { businessName: 'Test Corp' },
      });

      expect(result.subject).toBe('Welcome Test Corp');
      expect(result.body).toBe('Hello Test Corp, your account is approved.');
      expect(result.renderedAt).toBeDefined();
    });
  });
});
