import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import * as Handlebars from 'handlebars';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationTemplateVersion } from './entities/notification-template-version.entity';
import { NotificationDelivery, DeliveryStatus } from './entities/notification-delivery.entity';
import { UpdateNotificationTemplateDto } from './dto/notification-template.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditAction, ActorType } from '../database/entities/audit-log.enums';

@Injectable()
export class NotificationTemplateService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private templateRepo: Repository<NotificationTemplate>,
    @InjectRepository(NotificationTemplateVersion)
    private versionRepo: Repository<NotificationTemplateVersion>,
    @InjectRepository(NotificationDelivery)
    private deliveryRepo: Repository<NotificationDelivery>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private auditLogService: AuditLogService,
  ) {}

  async findAll() {
    const templates = await this.templateRepo.find({ order: { channel: 'ASC', displayName: 'ASC' } });
    const grouped = templates.reduce((acc, t) => {
      if (!acc[t.channel]) acc[t.channel] = [];
      acc[t.channel].push(t);
      return acc;
    }, {} as Record<string, NotificationTemplate[]>);
    return grouped;
  }

  async findOne(templateKey: string) {
    const template = await this.templateRepo.findOne({ where: { templateKey } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async update(templateKey: string, dto: UpdateNotificationTemplateDto, adminId: string) {
    const template = await this.findOne(templateKey);
    const beforeState = { ...template };

    if (dto.isActive === false && template.isSystemCritical) {
      throw new ConflictException('Cannot disable system-critical templates');
    }

    if (dto.bodyTemplate) {
      this.validateTemplate(dto.bodyTemplate, template.availableVariables);
    }

    if (dto.subjectTemplate) {
      this.validateTemplate(dto.subjectTemplate, template.availableVariables);
    }

    await this.saveVersion(template, adminId);

    Object.assign(template, dto);
    template.lastEditedById = adminId;
    template.lastEditedAt = new Date();

    const updated = await this.templateRepo.save(template);

    await this.auditLogService.log({
      entityType: 'NotificationTemplate',
      entityId: template.id,
      action: AuditAction.UPDATE,
      actorId: adminId,
      actorType: ActorType.ADMIN,
      beforeState: { bodyTemplate: beforeState.bodyTemplate, subjectTemplate: beforeState.subjectTemplate },
      afterState: { bodyTemplate: updated.bodyTemplate, subjectTemplate: updated.subjectTemplate },
      metadata: { templateKey },
    });

    return updated;
  }

  private validateTemplate(templateStr: string, availableVars: any[]) {
    try {
      const ast = Handlebars.parse(templateStr);
      const usedVars = this.extractVariables(ast);
      const availableNames = availableVars.map(v => v.name);
      
      for (const varName of usedVars) {
        if (!availableNames.includes(varName)) {
          throw new BadRequestException(`Variable '${varName}' is not available for this template`);
        }
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Invalid Handlebars syntax: ${error.message}`);
    }
  }

  private extractVariables(ast: hbs.AST.Program): string[] {
    const vars: string[] = [];
    const traverse = (node: any) => {
      if (node.type === 'MustacheStatement' || node.type === 'BlockStatement') {
        if (node.path?.type === 'PathExpression') {
          vars.push(node.path.original);
        }
      }
      if (node.body) {
        if (Array.isArray(node.body)) {
          node.body.forEach(traverse);
        } else {
          traverse(node.body);
        }
      }
      if (node.program) traverse(node.program);
      if (node.inverse) traverse(node.inverse);
    };
    traverse(ast);
    return [...new Set(vars)];
  }

  async preview(templateKey: string, variables: Record<string, unknown>) {
    const template = await this.findOne(templateKey);
    
    const subjectCompiled = template.subjectTemplate ? Handlebars.compile(template.subjectTemplate) : null;
    const bodyCompiled = Handlebars.compile(template.bodyTemplate);

    return {
      subject: subjectCompiled ? subjectCompiled(variables) : null,
      body: bodyCompiled(variables),
      renderedAt: new Date().toISOString(),
    };
  }

  async testSend(templateKey: string, recipientEmail: string, variables: Record<string, unknown>, adminId?: string) {
    const rendered = await this.preview(templateKey, variables);
    
    const delivery = this.deliveryRepo.create({
      templateKey,
      channel: 'EMAIL',
      recipientEmail,
      recipientPhone: null,
      merchantId: null,
      variables,
      status: DeliveryStatus.SENT,
      sentAt: new Date(),
    });

    await this.deliveryRepo.save(delivery);

    if (adminId) {
      await this.auditLogService.log({
        entityType: 'NotificationTemplate',
        entityId: templateKey,
        action: AuditAction.VIEW,
        actorId: adminId,
        actorType: ActorType.ADMIN,
        metadata: { action: 'test_send', recipientEmail },
      });
    }

    return { message: 'Test email sent', delivery };
  }

  private async saveVersion(template: NotificationTemplate, adminId: string) {
    const version = this.versionRepo.create({
      templateKey: template.templateKey,
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
      editedById: adminId,
      changes: null,
    });

    await this.versionRepo.save(version);

    const versions = await this.versionRepo.find({
      where: { templateKey: template.templateKey },
      order: { createdAt: 'DESC' },
    });

    if (versions.length > 10) {
      const toDelete = versions.slice(10);
      await this.versionRepo.remove(toDelete);
    }
  }

  async getVersions(templateKey: string) {
    await this.findOne(templateKey);
    return this.versionRepo.find({
      where: { templateKey },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async rollback(templateKey: string, versionId: string, adminId: string) {
    const template = await this.findOne(templateKey);
    const version = await this.versionRepo.findOne({ where: { id: versionId, templateKey } });
    
    if (!version) throw new NotFoundException('Version not found');

    await this.saveVersion(template, adminId);

    template.subjectTemplate = version.subjectTemplate;
    template.bodyTemplate = version.bodyTemplate;
    template.lastEditedById = adminId;
    template.lastEditedAt = new Date();

    return this.templateRepo.save(template);
  }

  async findDeliveries(query: any) {
    const where: any = {};
    
    if (query.merchantId) where.merchantId = query.merchantId;
    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;
    if (query.templateKey) where.templateKey = query.templateKey;
    
    if (query.createdAfter || query.createdBefore) {
      where.createdAt = Between(
        query.createdAfter ? new Date(query.createdAfter) : new Date(0),
        query.createdBefore ? new Date(query.createdBefore) : new Date(),
      );
    }

    return this.deliveryRepo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  async findDeliveryById(id: string) {
    const delivery = await this.deliveryRepo.findOne({ where: { id } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  async retryDelivery(id: string) {
    const delivery = await this.findDeliveryById(id);
    
    if (delivery.status !== DeliveryStatus.FAILED) {
      throw new BadRequestException('Only failed deliveries can be retried');
    }

    delivery.status = DeliveryStatus.QUEUED;
    delivery.attemptCount += 1;
    delivery.failureReason = null;

    return this.deliveryRepo.save(delivery);
  }

  async getStats() {
    const cacheKey = 'notification:stats';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const deliveries = await this.deliveryRepo.find({
      where: { createdAt: Between(last24h, new Date()) },
    });

    const totalSent = deliveries.length;
    const delivered = deliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length;
    const failed = deliveries.filter(d => d.status === DeliveryStatus.FAILED).length;
    const bounced = deliveries.filter(d => d.status === DeliveryStatus.BOUNCED).length;

    const byChannel = deliveries.reduce((acc, d) => {
      if (!acc[d.channel]) acc[d.channel] = { sent: 0, delivered: 0 };
      acc[d.channel].sent += 1;
      if (d.status === DeliveryStatus.DELIVERED) acc[d.channel].delivered += 1;
      return acc;
    }, {} as Record<string, any>);

    Object.keys(byChannel).forEach(ch => {
      byChannel[ch].deliveryRate = ((byChannel[ch].delivered / byChannel[ch].sent) * 100).toFixed(1);
    });

    const byTemplate = deliveries.reduce((acc, d) => {
      if (!acc[d.templateKey]) acc[d.templateKey] = { sent: 0, delivered: 0 };
      acc[d.templateKey].sent += 1;
      if (d.status === DeliveryStatus.DELIVERED) acc[d.templateKey].delivered += 1;
      return acc;
    }, {} as Record<string, any>);

    const byTemplateArray = Object.entries(byTemplate).map(([key, val]: [string, any]) => ({
      templateKey: key,
      sent: val.sent,
      deliveryRate: ((val.delivered / val.sent) * 100).toFixed(1),
    }));

    const stats = {
      last24h: {
        totalSent,
        delivered,
        failed,
        bounced,
        deliveryRate: totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(1) : '0',
      },
      byChannel,
      byTemplate: byTemplateArray,
    };

    await this.cacheManager.set(cacheKey, stats, 300000); // 5 minutes
    return stats;
  }
}
