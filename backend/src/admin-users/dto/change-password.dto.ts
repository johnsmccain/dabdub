import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password (min 12 chars, upper, lower, digit, special)',
    minLength: 12,
  })
  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)',
  })
  newPassword: string;

  @ApiProperty({ description: 'Must match newPassword' })
  @IsString()
  confirmNewPassword: string;
}
