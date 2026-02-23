import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateNotificationTemplateTables1708000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notification_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'templateKey',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'displayName',
            type: 'varchar',
          },
          {
            name: 'channel',
            type: 'enum',
            enum: ['EMAIL', 'SMS', 'WEBHOOK'],
          },
          {
            name: 'subjectTemplate',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'bodyTemplate',
            type: 'text',
          },
          {
            name: 'availableVariables',
            type: 'jsonb',
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'isSystemCritical',
            type: 'boolean',
            default: false,
          },
          {
            name: 'lastEditedById',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'lastEditedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'deletedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'notification_template_versions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'templateKey',
            type: 'varchar',
          },
          {
            name: 'subjectTemplate',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'bodyTemplate',
            type: 'text',
          },
          {
            name: 'editedById',
            type: 'varchar',
          },
          {
            name: 'changes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'deletedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'notification_template_versions',
      new TableIndex({
        name: 'IDX_template_versions_key',
        columnNames: ['templateKey'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'notification_deliveries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'templateKey',
            type: 'varchar',
          },
          {
            name: 'channel',
            type: 'varchar',
          },
          {
            name: 'recipientEmail',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'recipientPhone',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'merchantId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'variables',
            type: 'jsonb',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED'],
          },
          {
            name: 'providerMessageId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'failureReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'attemptCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'sentAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'deliveredAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'deletedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'notification_deliveries',
      new TableIndex({
        name: 'IDX_deliveries_merchant',
        columnNames: ['merchantId'],
      }),
    );

    await queryRunner.createIndex(
      'notification_deliveries',
      new TableIndex({
        name: 'IDX_deliveries_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'notification_deliveries',
      new TableIndex({
        name: 'IDX_deliveries_created',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('notification_deliveries');
    await queryRunner.dropTable('notification_template_versions');
    await queryRunner.dropTable('notification_templates');
  }
}
