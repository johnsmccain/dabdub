import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  IsEmail,
  ValidateNested,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExportFormat, ReportDataSource } from '../enums/report.enums';

// ── Sub-object DTOs ───────────────────────────────────────────────────────────

export class ReportColumnDto {
  @IsString()
  field: string;

  @IsString()
  alias: string;

  @IsBoolean()
  include: boolean;
}

export class ReportFilterDto {
  @IsString()
  field: string;

  @IsIn(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'in'])
  operator: string;

  value: string | number | boolean | string[];
}

export class ReportSortDto {
  @IsString()
  field: string;

  @IsIn(['ASC', 'DESC'])
  direction: 'ASC' | 'DESC';
}

// ── Main DTOs ─────────────────────────────────────────────────────────────────

export class CreateSavedReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ReportDataSource)
  dataSource: ReportDataSource;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportColumnDto)
  columns: ReportColumnDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters: ReportFilterDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportSortDto)
  sorting: ReportSortDto[];

  @IsEnum(ExportFormat)
  defaultFormat: ExportFormat;

  @IsBoolean()
  isShared: boolean;
}

export class UpdateSavedReportDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportColumnDto)
  columns?: ReportColumnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters?: ReportFilterDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportSortDto)
  sorting?: ReportSortDto[];

  @IsOptional()
  @IsEnum(ExportFormat)
  defaultFormat?: ExportFormat;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}

export class ScheduleReportDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  scheduleExpression?: string;

  @IsOptional()
  @IsArray()
  @IsEmail(undefined, { each: true })
  recipientEmails?: string[];

  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;
}

export class ListReportsQueryDto {
  @IsOptional()
  @IsEnum(ReportDataSource)
  dataSource?: ReportDataSource;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isScheduled?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isShared?: boolean;
}
