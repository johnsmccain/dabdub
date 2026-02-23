import { IsOptional, IsString, IsBoolean, MinLength, IsObject } from 'class-validator';

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  subjectTemplate?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  bodyTemplate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PreviewTemplateDto {
  @IsObject()
  variables: Record<string, unknown>;
}

export class TestSendDto {
  @IsString()
  recipientEmail: string;

  @IsObject()
  variables: Record<string, unknown>;
}

export class ListDeliveriesQueryDto {
  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsString()
  createdAfter?: string;

  @IsOptional()
  @IsString()
  createdBefore?: string;
}
