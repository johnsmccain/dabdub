import { DataSource } from 'typeorm';
import { NotificationTemplate, NotificationChannel } from '../../notification/entities/notification-template.entity';

export async function seedNotificationTemplates(dataSource: DataSource) {
  const templateRepo = dataSource.getRepository(NotificationTemplate);

  const templates = [
    {
      templateKey: 'merchant.kyc.approved',
      displayName: 'KYC Approved',
      channel: NotificationChannel.EMAIL,
      subjectTemplate: 'Welcome to DabDub - Your account is approved!',
      bodyTemplate: `Hello {{merchant.businessName}},

Congratulations! Your KYC verification has been approved.

You can now start accepting crypto payments and receiving instant fiat settlements.

Best regards,
The DabDub Team`,
      availableVariables: [
        { name: 'merchant.businessName', type: 'string', required: true, example: 'Acme Corp' },
        { name: 'merchant.email', type: 'string', required: true, example: 'merchant@example.com' },
      ],
      isActive: true,
      isSystemCritical: true,
    },
    {
      templateKey: 'merchant.kyc.rejected',
      displayName: 'KYC Rejected',
      channel: NotificationChannel.EMAIL,
      subjectTemplate: 'KYC Verification Update',
      bodyTemplate: `Hello {{merchant.businessName}},

Unfortunately, we were unable to verify your KYC documents.

Reason: {{rejection.reason}}

Please resubmit your documents or contact support for assistance.

Best regards,
The DabDub Team`,
      availableVariables: [
        { name: 'merchant.businessName', type: 'string', required: true, example: 'Acme Corp' },
        { name: 'rejection.reason', type: 'string', required: true, example: 'Document quality issue' },
      ],
      isActive: true,
      isSystemCritical: true,
    },
    {
      templateKey: 'merchant.suspended',
      displayName: 'Account Suspended',
      channel: NotificationChannel.EMAIL,
      subjectTemplate: 'Important: Your DabDub account has been suspended',
      bodyTemplate: `Hello {{merchant.businessName}},

Your account has been temporarily suspended.

Reason: {{suspension.reason}}

Please contact support immediately to resolve this issue.

Best regards,
The DabDub Team`,
      availableVariables: [
        { name: 'merchant.businessName', type: 'string', required: true, example: 'Acme Corp' },
        { name: 'suspension.reason', type: 'string', required: true, example: 'Suspicious activity detected' },
      ],
      isActive: true,
      isSystemCritical: true,
    },
    {
      templateKey: 'settlement.completed',
      displayName: 'Settlement Completed',
      channel: NotificationChannel.EMAIL,
      subjectTemplate: 'Settlement Completed - {{settlement.amount}} {{settlement.currency}}',
      bodyTemplate: `Hello {{merchant.businessName}},

Your settlement has been completed successfully.

Amount: {{settlement.amount}} {{settlement.currency}}
Transaction ID: {{settlement.transactionId}}
Date: {{settlement.completedAt}}

The funds should appear in your bank account within 1-2 business days.

Best regards,
The DabDub Team`,
      availableVariables: [
        { name: 'merchant.businessName', type: 'string', required: true, example: 'Acme Corp' },
        { name: 'settlement.amount', type: 'number', required: true, example: '1000.00' },
        { name: 'settlement.currency', type: 'string', required: true, example: 'USD' },
        { name: 'settlement.transactionId', type: 'string', required: true, example: 'TXN123456' },
        { name: 'settlement.completedAt', type: 'string', required: true, example: '2024-02-19 10:00:00' },
      ],
      isActive: true,
      isSystemCritical: false,
    },
    {
      templateKey: 'settlement.failed',
      displayName: 'Settlement Failed',
      channel: NotificationChannel.EMAIL,
      subjectTemplate: 'Settlement Failed - Action Required',
      bodyTemplate: `Hello {{merchant.businessName}},

Your settlement has failed.

Amount: {{settlement.amount}} {{settlement.currency}}
Reason: {{failure.reason}}

Please update your bank account details or contact support.

Best regards,
The DabDub Team`,
      availableVariables: [
        { name: 'merchant.businessName', type: 'string', required: true, example: 'Acme Corp' },
        { name: 'settlement.amount', type: 'number', required: true, example: '1000.00' },
        { name: 'settlement.currency', type: 'string', required: true, example: 'USD' },
        { name: 'failure.reason', type: 'string', required: true, example: 'Invalid bank account' },
      ],
      isActive: true,
      isSystemCritical: true,
    },
    {
      templateKey: 'payment.received',
      displayName: 'Payment Received',
      channel: NotificationChannel.SMS,
      subjectTemplate: null,
      bodyTemplate: 'Payment received: {{payment.amount}} {{payment.currency}} from {{customer.name}}. Ref: {{payment.reference}}',
      availableVariables: [
        { name: 'payment.amount', type: 'number', required: true, example: '100.00' },
        { name: 'payment.currency', type: 'string', required: true, example: 'USDC' },
        { name: 'customer.name', type: 'string', required: false, example: 'John Doe' },
        { name: 'payment.reference', type: 'string', required: true, example: 'PAY123' },
      ],
      isActive: true,
      isSystemCritical: false,
    },
  ];

  for (const template of templates) {
    const existing = await templateRepo.findOne({ where: { templateKey: template.templateKey } });
    if (!existing) {
      await templateRepo.save(templateRepo.create(template));
      console.log(`✓ Created template: ${template.templateKey}`);
    }
  }
}
