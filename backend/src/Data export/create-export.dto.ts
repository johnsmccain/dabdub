import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExportFormat, ExportResourceType } from '../enums/export.enums';

export class ExportFiltersDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  // Generic catch-all for resource-specific filters
  [key: string]: unknown;
}

export class CreateExportDto {
  @IsEnum(ExportResourceType)
  resourceType: ExportResourceType;

  @ValidateNested()
  @Type(() => ExportFiltersDto)
  filters: ExportFiltersDto;

  @IsEnum(ExportFormat)
  format: ExportFormat;
}
