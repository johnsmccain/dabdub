import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddMerchantLifecycleEntities1708450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add suspendedAt column to merchants table
    await queryRunner.query(`
      ALTER TABLE merchants
      ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP NULL;
    `);

    // Update MerchantStatus enum to include TERMINATED
    await queryRunner.query(`
      ALTER TYPE merchant_status ADD VALUE IF NOT EXISTS 'terminated';
    `);

    // Create merchant_suspensions table
    await queryRunner.createTable(
      new Table({
        name: 'merchant_suspensions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'enum',
            enum: [
              'FRAUD_INVESTIGATION',
              'AML_REVIEW',
              'CHARGEBACK_THRESHOLD',
              'POLICY_VIOLATION',
              'MANUAL',
            ],
            isNullable: false,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'suspended_by_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'suspended_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'auto_unsuspend_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'unsuspended_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'unsuspended_by_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'unsuspension_note',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for merchant_suspensions
    await queryRunner.createIndex(
      'merchant_suspensions',
      new TableIndex({
        name: 'IDX_merchant_suspensions_merchant_id',
        columnNames: ['merchant_id'],
      }),
    );

    await queryRunner.createIndex(
      'merchant_suspensions',
      new TableIndex({
        name: 'IDX_merchant_suspensions_suspended_at',
        columnNames: ['suspended_at'],
      }),
    );

    // Create foreign key for merchant_suspensions
    await queryRunner.createForeignKey(
      'merchant_suspensions',
      new TableForeignKey({
        columnNames: ['merchant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'merchants',
        onDelete: 'CASCADE',
      }),
    );

    // Create merchant_terminations table
    await queryRunner.createTable(
      new Table({
        name: 'merchant_terminations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchant_id',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'reason',
            type: 'enum',
            enum: [
              'FRAUD_CONFIRMED',
              'AML_VIOLATION',
              'REPEATED_POLICY_VIOLATIONS',
              'MERCHANT_REQUEST',
              'OTHER',
            ],
            isNullable: false,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'terminated_by_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'terminated_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'final_settlement_job_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'final_settlement_completed_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for merchant_terminations
    await queryRunner.createIndex(
      'merchant_terminations',
      new TableIndex({
        name: 'IDX_merchant_terminations_merchant_id',
        columnNames: ['merchant_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'merchant_terminations',
      new TableIndex({
        name: 'IDX_merchant_terminations_terminated_at',
        columnNames: ['terminated_at'],
      }),
    );

    // Create foreign key for merchant_terminations
    await queryRunner.createForeignKey(
      'merchant_terminations',
      new TableForeignKey({
        columnNames: ['merchant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'merchants',
        onDelete: 'CASCADE',
      }),
    );

    // Create merchant_flags table
    await queryRunner.createTable(
      new Table({
        name: 'merchant_flags',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'AML_ALERT',
              'FRAUD_SUSPECTED',
              'CHARGEBACK_RATIO_HIGH',
              'PROHIBITED_GOODS',
              'PEP_MATCH',
              'SANCTIONS_MATCH',
            ],
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'enum',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'created_by_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'resolved_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'resolved_by_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'resolution',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for merchant_flags
    await queryRunner.createIndex(
      'merchant_flags',
      new TableIndex({
        name: 'IDX_merchant_flags_merchant_id',
        columnNames: ['merchant_id'],
      }),
    );

    await queryRunner.createIndex(
      'merchant_flags',
      new TableIndex({
        name: 'IDX_merchant_flags_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'merchant_flags',
      new TableIndex({
        name: 'IDX_merchant_flags_resolved_at',
        columnNames: ['resolved_at'],
      }),
    );

    // Create foreign key for merchant_flags
    await queryRunner.createForeignKey(
      'merchant_flags',
      new TableForeignKey({
        columnNames: ['merchant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'merchants',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop merchant_flags table
    await queryRunner.dropTable('merchant_flags', true);

    // Drop merchant_terminations table
    await queryRunner.dropTable('merchant_terminations', true);

    // Drop merchant_suspensions table
    await queryRunner.dropTable('merchant_suspensions', true);

    // Remove suspendedAt column from merchants table
    await queryRunner.query(`
      ALTER TABLE merchants
      DROP COLUMN IF EXISTS suspended_at;
    `);
  }
}
