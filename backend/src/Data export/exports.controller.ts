import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ExportsService } from './exports.service';
import { CreateExportDto } from './dto/create-export.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

/**
 * The authenticated admin is attached to request.user by JwtAuthGuard.
 * Shape: { id: string; email: string; role: string }
 */
interface AdminUser {
  id: string;
  email: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller('api/v1/exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('exports:create')
  async createExport(@Body() dto: CreateExportDto, @Req() req: Request) {
    const admin = req.user as AdminUser;
    return this.exportsService.createExport(admin.id, dto);
  }

  @Get(':id')
  @RequirePermission('exports:read')
  async getExport(@Param('id') id: string, @Req() req: Request) {
    const admin = req.user as AdminUser;
    const isSuperAdmin = admin.role === 'SUPER_ADMIN';
    return this.exportsService.getExport(id, admin.id, isSuperAdmin);
  }

  @Get()
  @RequirePermission('exports:read')
  async listExports(@Req() req: Request) {
    const admin = req.user as AdminUser;
    const isSuperAdmin = admin.role === 'SUPER_ADMIN';
    return this.exportsService.listExports(admin.id, isSuperAdmin);
  }
}
