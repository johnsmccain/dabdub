import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddTransactionPerformanceIndexes1740000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns if they don't exist
    const table = await queryRunner.getTable('transactions');
    
    if (table && !table.findColumnByName('flagged_for_review')) {
      await queryRunner.addColumn(
        'transactions',
        new TableColumn({
          name: 'flagged_for_review',
          type: 'boolean',
          default: false,
        }),
      );
    }

    if (table && !table.findColumnByName('fee_collected_usd')) {
      await queryRunner.addColumn(
        'transactions',
        new TableColumn({
          name: 'fee_collected_usd',
          type: 'decimal',
          precision: 20,
          scale: 8,
          isNullable: true,
        }),
      );
    }

    if (table && !table.findColumnByName('settlement_id')) {
      await queryRunner.addColumn(
        'transactions',
        new TableColumn({
          name: 'settlement_id',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }

    if (table && !table.findColumnByName('metadata')) {
      await queryRunner.addColumn(
        'transactions',
        new TableColumn({
          name: 'metadata',
          type: 'jsonb',
          isNullable: true,
        }),
      );
    }

    // Create performance indexes
    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_transactions_payment_request_created',
        columnNames: ['payment_request_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_transactions_status_created',
        columnNames: ['status', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_transactions_network_token',
        columnNames: ['network', 'token_symbol'],
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'IDX_transactions_flagged',
        columnNames: ['flagged_for_review'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('transactions', 'IDX_transactions_payment_request_created');
    await queryRunner.dropIndex('transactions', 'IDX_transactions_status_created');
    await queryRunner.dropIndex('transactions', 'IDX_transactions_network_token');
    await queryRunner.dropIndex('transactions', 'IDX_transactions_flagged');

    // Drop columns
    const table = await queryRunner.getTable('transactions');
    
    if (table?.findColumnByName('metadata')) {
      await queryRunner.dropColumn('transactions', 'metadata');
    }

    if (table?.findColumnByName('settlement_id')) {
      await queryRunner.dropColumn('transactions', 'settlement_id');
    }

    if (table?.findColumnByName('fee_collected_usd')) {
      await queryRunner.dropColumn('transactions', 'fee_collected_usd');
    }

    if (table?.findColumnByName('flagged_for_review')) {
      await queryRunner.dropColumn('transactions', 'flagged_for_review');
    }
  }
}
