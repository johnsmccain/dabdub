import {
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SuspensionReason,
  MerchantSuspension,
} from '../entities/merchant-suspension.entity';
import {
  TerminationReason,
  MerchantTermination,
} from '../entities/merchant-termination.entity';
import {
  FlagType,
  FlagSeverity,
  MerchantFlag,
} from '../entities/merchant-flag.entity';

// Suspend Merchant DTO
export class SuspendMerchantDto {
  @ApiProperty({
    enum: SuspensionReason,
    example: SuspensionReason.FRAUD_INVESTIGATION,
  })
  @IsEnum(SuspensionReason)
  reason: SuspensionReason;

  @ApiProperty({
    example: 'Suspicious transaction patterns detected requiring investigation',
    minLength: 20,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  note: string;

  @ApiPropertyOptional({
    example: 24,
    description: 'Duration in hours for auto-unsuspend. Null = indefinite',
    minimum: 1,
    maximum: 8760,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760)
  durationHours?: number;
}

// Unsuspend Merchant DTO
export class UnsuspendMerchantDto {
  @ApiProperty({
    example: 'Investigation completed. No violations found.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  note: string;
}

// Terminate Merchant DTO
export class TerminateMerchantDto {
  @ApiProperty({
    enum: TerminationReason,
    example: TerminationReason.FRAUD_CONFIRMED,
  })
  @IsEnum(TerminationReason)
  reason: TerminationReason;

  @ApiProperty({
    example:
      'Confirmed fraudulent activity with multiple chargebacks and customer complaints. Account permanently closed per terms of service section 8.3.',
    minLength: 50,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  note: string;

  @ApiProperty({
    example: true,
    description: 'Must explicitly confirm termination',
  })
  @IsBoolean()
  confirmed: boolean;
}

// Add Merchant Flag DTO
export class AddMerchantFlagDto {
  @ApiProperty({
    enum: FlagType,
    example: FlagType.AML_ALERT,
  })
  @IsEnum(FlagType)
  type: FlagType;

  @ApiProperty({
    enum: FlagSeverity,
    example: FlagSeverity.HIGH,
  })
  @IsEnum(FlagSeverity)
  severity: FlagSeverity;

  @ApiProperty({
    example: 'Multiple transactions flagged by AML monitoring system',
    minLength: 20,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({
    example: '2026-03-20T00:00:00Z',
    description: 'Optional expiration date for the flag',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// Resolve Merchant Flag DTO
export class ResolveMerchantFlagDto {
  @ApiProperty({
    example: 'False positive. Transactions verified as legitimate.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  resolution: string;
}

// Response DTOs
export class MerchantSuspensionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  merchantId: string;

  @ApiProperty({ enum: SuspensionReason })
  reason: SuspensionReason;

  @ApiProperty()
  note: string;

  @ApiProperty()
  suspendedById: string;

  @ApiProperty()
  suspendedAt: Date;

  @ApiProperty({ nullable: true })
  autoUnsuspendAt: Date | null;

  @ApiProperty({ nullable: true })
  unsuspendedAt: Date | null;

  @ApiProperty({ nullable: true })
  unsuspendedById: string | null;

  @ApiProperty({ nullable: true })
  unsuspensionNote: string | null;

  static fromEntity(entity: MerchantSuspension): MerchantSuspensionResponseDto {
    const dto = new MerchantSuspensionResponseDto();
    dto.id = entity.id;
    dto.merchantId = entity.merchantId;
    dto.reason = entity.reason;
    dto.note = entity.note;
    dto.suspendedById = entity.suspendedById;
    dto.suspendedAt = entity.suspendedAt;
    dto.autoUnsuspendAt = entity.autoUnsuspendAt;
    dto.unsuspendedAt = entity.unsuspendedAt;
    dto.unsuspendedById = entity.unsuspendedById;
    dto.unsuspensionNote = entity.unsuspensionNote;
    return dto;
  }
}

export class MerchantTerminationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  merchantId: string;

  @ApiProperty({ enum: TerminationReason })
  reason: TerminationReason;

  @ApiProperty()
  terminatedById: string;

  @ApiProperty()
  terminatedAt: Date;

  @ApiProperty({ nullable: true })
  finalSettlementJobId: string | null;

  @ApiProperty({ nullable: true })
  finalSettlementCompletedAt: Date | null;

  static fromEntity(entity: MerchantTermination): MerchantTerminationResponseDto {
    const dto = new MerchantTerminationResponseDto();
    dto.id = entity.id;
    dto.merchantId = entity.merchantId;
    dto.reason = entity.reason;
    dto.terminatedById = entity.terminatedById;
    dto.terminatedAt = entity.terminatedAt;
    dto.finalSettlementJobId = entity.finalSettlementJobId;
    dto.finalSettlementCompletedAt = entity.finalSettlementCompletedAt;
    return dto;
  }
}

export class MerchantFlagResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  merchantId: string;

  @ApiProperty({ enum: FlagType })
  type: FlagType;

  @ApiProperty({ enum: FlagSeverity })
  severity: FlagSeverity;

  @ApiProperty()
  description: string;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  expiresAt: Date | null;

  @ApiProperty({ nullable: true })
  resolvedAt: Date | null;

  @ApiProperty({ nullable: true })
  resolvedById: string | null;

  @ApiProperty({ nullable: true })
  resolution: string | null;

  static fromEntity(entity: MerchantFlag): MerchantFlagResponseDto {
    const dto = new MerchantFlagResponseDto();
    dto.id = entity.id;
    dto.merchantId = entity.merchantId;
    dto.type = entity.type;
    dto.severity = entity.severity;
    dto.description = entity.description;
    dto.createdById = entity.createdById;
    dto.createdAt = entity.createdAt;
    dto.expiresAt = entity.expiresAt;
    dto.resolvedAt = entity.resolvedAt;
    dto.resolvedById = entity.resolvedById;
    dto.resolution = entity.resolution;
    return dto;
  }
}
