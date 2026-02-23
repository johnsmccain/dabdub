import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { NotificationService } from './notification.service';
import { NotificationProcessor } from './notification.processor';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationTemplateVersion } from './entities/notification-template-version.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { PushProvider } from './providers/push.provider';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationTemplateController } from './notification-template.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      NotificationTemplate,
      NotificationTemplateVersion,
      NotificationDelivery,
    ]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    AuditModule,
  ],
  controllers: [NotificationTemplateController],
  providers: [
    NotificationService,
    NotificationProcessor,
    EmailProvider,
    SmsProvider,
    PushProvider,
    NotificationTemplateService,
  ],
  exports: [NotificationService, NotificationTemplateService],
})
export class NotificationModule {}
