import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { RequireSuperAdminGuard } from './guards/require-super-admin.guard';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { PaginationMetaDto } from '../common/dto/pagination.dto';

@ApiTags('Admin Users')
@Controller('api/v1/admin/users')
@UseGuards(AdminJwtGuard, RequireSuperAdminGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create admin user (SUPER_ADMIN only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Admin user created' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not SUPER_ADMIN' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already exists' })
  async create(@Body() dto: CreateAdminUserDto, @Req() req: any) {
    const currentAdminId = req.user?.sub ?? req.user?.id;
    const created = await this.adminUsersService.create(dto, currentAdminId);
    return this.toAdminUserResponse(created);
  }

  @Get()
  @ApiOperation({ summary: 'List admin users (SUPER_ADMIN only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Paginated list' })
  async findAll(@Query() query: ListAdminUsersQueryDto) {
    const { data, meta } = await this.adminUsersService.findAll(query);
    return {
      data: data.map((a) => this.toAdminUserResponse(a)),
      meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin user detail (SUPER_ADMIN only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Admin user with login history and sessions' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not found' })
  async findOne(@Param('id') id: string) {
    const detail = await this.adminUsersService.findOneWithDetail(id);
    return {
      ...this.toAdminUserResponse(detail.admin),
      activeSessionCount: detail.activeSessionCount,
      loginHistory: detail.loginHistory,
      recentAuditActions: detail.recentAuditActions,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin user (SUPER_ADMIN only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Updated' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Cannot change own role/status or last SUPER_ADMIN' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
    @Req() req: any,
  ) {
    const currentAdminId = req.user?.sub ?? req.user?.id;
    const role = req.user?.role;
    const updated = await this.adminUsersService.update(id, dto, currentAdminId, role);
    return this.toAdminUserResponse(updated);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete admin user (SUPER_ADMIN only)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Cannot delete self or last SUPER_ADMIN' })
  async remove(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const currentAdminId = req.user?.sub ?? req.user?.id;
    await this.adminUsersService.remove(id, currentAdminId);
    return res.send();
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Force password reset (SUPER_ADMIN only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns temporary password' })
  async resetPassword(@Param('id') id: string, @Req() req: any) {
    const currentAdminId = req.user?.sub ?? req.user?.id;
    return this.adminUsersService.resetPassword(id, currentAdminId);
  }

  private toAdminUserResponse(admin: any) {
    const createdBy = admin.createdBy
      ? {
          id: admin.createdBy.id,
          email: admin.createdBy.email,
          firstName: admin.createdBy.firstName,
          lastName: admin.createdBy.lastName,
        }
      : undefined;
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      status: admin.status,
      customPermissions: admin.customPermissions ?? [],
      revokedPermissions: admin.revokedPermissions ?? [],
      mustChangePassword: admin.mustChangePassword,
      twoFactorEnabled: admin.twoFactorEnabled,
      createdAt: admin.createdAt,
      createdBy,
    };
  }
}
