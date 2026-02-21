import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantController } from './controllers/merchant.controller';
import { MerchantLifecycleController } from './controllers/merchant-lifecycle.controller';
import { MerchantService } from './services/merchant.service';
import { MerchantLifecycleService } from './services/merchant-lifecycle.service';
import { MerchantLifecycleProcessor } from './processors/merchant-lifecycle.processor';
import { Merchant } from '../database/entities/merchant.entity';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MerchantJwtStrategy } from './strategies/merchant-jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { MerchantAuditLog } from './entities/merchant-audit-log.entity';
import { MerchantNote } from './entities/merchant-note.entity';
import { MerchantSuspension } from './entities/merchant-suspension.entity';
import { MerchantTermination } from './entities/merchant-termination.entity';
import { MerchantFlag } from './entities/merchant-flag.entity';
import { ApiKey } from '../api-key/entities/api-key.entity';
import { BullModule } from '@nestjs/bullmq';



@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantAuditLog,
      MerchantNote,
      MerchantSuspension,
      MerchantTermination,
      MerchantFlag,
      ApiKey,
    ]),
    BullModule.registerQueue(
      { name: 'settlements' },
      { name: 'notifications' },
    ),


    AuthModule, // Assuming we might need auth services like PasswordService if exported, or we replicate logic
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            '1d') as any,
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  controllers: [MerchantController, MerchantLifecycleController],
  providers: [
    MerchantService,
    MerchantLifecycleService,
    MerchantLifecycleProcessor,
    MerchantJwtStrategy,
  ],
  exports: [MerchantService, MerchantLifecycleService],
})
export class MerchantModule { }
