import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsArray,
  IsIn,
  IsPhoneNumber,
} from 'class-validator';
import { AdminRole } from '../../database/entities/admin-user.entity';
import { ALL_PERMISSIONS } from '../constants/permissions';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'newadmin@cheese.io' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Smith', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ enum: AdminRole })
  @IsEnum(AdminRole)
  role: AdminRole;

  @ApiPropertyOptional({ description: 'Permissions added on top of role defaults' })
  @IsOptional()
  @IsArray()
  @IsIn(ALL_PERMISSIONS, { each: true })
  customPermissions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;
}
