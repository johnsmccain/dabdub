import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { AdminJwtGuard } from 'src/auth/guards/admin-jwt.guard';
import { PermissionGuard } from 'src/auth/guards/permission.guard';
import { ExportFormat } from 'src/Data export/export.enums';
import { UserRole } from 'src/database/entities/user.entity';
import {
  ListReportsQueryDto,
  CreateSavedReportDto,
  UpdateSavedReportDto,
  ScheduleReportDto,
} from './dto/saved-report.dto';
import { SavedReportService } from './services/saved-report.service';

@Controller('api/v1/reports')
@UseGuards(AdminJwtGuard, PermissionGuard)
@Permissions('analytics:read')
export class ReportsController {
  constructor(private readonly reportService: SavedReportService) {}

  // ── List ─────────────────────────────────────────────────────────────────────

  @Get()
  listReports(@Query() query: ListReportsQueryDto, @CurrentUser() user: any) {
    return this.reportService.listReports(user.id, query);
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  @Post()
  create(@Body() dto: CreateSavedReportDto, @CurrentUser() user: any) {
    return this.reportService.create(dto, user.id);
  }

  // ── Get single ────────────────────────────────────────────────────────────────

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.reportService.findById(id, user.id);
  }

  // ── Update (creator or SUPER_ADMIN only) ──────────────────────────────────────

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportService.update(id, dto, user.id, user.role as UserRole);
  }

  // ── Delete (creator or SUPER_ADMIN only) ──────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.reportService.delete(id, user.id, user.role as UserRole);
  }

  // ── Run immediately ───────────────────────────────────────────────────────────

  @Post(':id/run')
  runReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body('format') format?: ExportFormat,
  ) {
    return this.reportService.run(id, user.id, format);
  }

  // ── Preview (first 20 rows, synchronous) ──────────────────────────────────────

  @Post(':id/preview')
  previewReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.reportService.preview(id, user.id);
  }

  // ── Configure schedule ────────────────────────────────────────────────────────

  @Patch(':id/schedule')
  configureSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportService.schedule(id, dto, user.id, user.role as UserRole);
  }

  // ── Execution history ─────────────────────────────────────────────────────────

  @Get(':id/runs')
  getRuns(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.reportService.getRuns(id, user.id);
  }
}
