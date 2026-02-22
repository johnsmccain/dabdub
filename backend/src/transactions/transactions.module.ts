import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { TransactionStatusHistory } from './entities/transaction-status-history.entity';
import { Settlement } from '../settlement/entities/settlement.entity';
import { WebhookDeliveryLogEntity } from '../database/entities/webhook-delivery-log.entity';
import { TransactionExportProcessor, TRANSACTION_EXPORT_QUEUE } from './transaction-export.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionStatusHistory,
      Settlement,
      WebhookDeliveryLogEntity,
    ]),
    BullModule.registerQueue({ name: TRANSACTION_EXPORT_QUEUE }),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionExportProcessor],
  exports: [TransactionsService],
})
export class TransactionsModule { }
