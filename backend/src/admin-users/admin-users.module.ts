import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from '../database/entities/admin-user.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { AuthChangePasswordController } from './auth-change-password.controller';
import { RequireSuperAdminGuard } from './guards/require-super-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser]),
    AuditModule,
    AuthModule,
  ],
  controllers: [AdminUsersController, AuthChangePasswordController],
  providers: [AdminUsersService, RequireSuperAdminGuard],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
