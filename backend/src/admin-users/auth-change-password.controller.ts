import { Controller, Post, Body, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { AdminUsersService } from './admin-users.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Auth')
@Controller('api/v1/auth')
@UseGuards(AdminJwtGuard)
@ApiBearerAuth()
export class AuthChangePasswordController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Post('change-password')
  @ApiOperation({ summary: 'Change own password (any authenticated admin)' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 400, description: 'Validation or current password incorrect' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    let adminId: string | undefined = req.user?.sub;
    if (!adminId && req.user?.email) {
      const admin = await this.adminUsersService.findOneByEmail(req.user.email);
      adminId = admin?.id;
    }
    if (!adminId) {
      throw new UnauthorizedException('Admin user not found for this account');
    }
    const currentSessionId = req.user?.sessionId;
    await this.adminUsersService.changeOwnPassword(
      adminId,
      dto.currentPassword,
      dto.newPassword,
      dto.confirmNewPassword,
      currentSessionId,
      req.ip ?? req.socket?.remoteAddress,
      req.get?.('user-agent'),
    );
    return { message: 'Password changed successfully' };
  }
}
