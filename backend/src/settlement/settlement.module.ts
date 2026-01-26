import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettlementEntity } from '../database/entities/settlement.entity';
import { SettlementRepository } from './repositories/settlement.repository';
import { SettlementService } from './services/settlement.service';
import { SettlementController } from './controllers/settlement.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SettlementEntity])],
  controllers: [SettlementController],
  providers: [SettlementService, SettlementRepository],
  exports: [SettlementService],
})
export class SettlementModule {}
