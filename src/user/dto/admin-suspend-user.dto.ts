import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AdminSuspendUserDto {
  @ApiProperty({
    description: 'Whether to suspend (true) or unsuspend (false) the user',
    example: true,
  })
  @IsBoolean()
  suspended!: boolean;

  @ApiProperty({
    description: 'Suspension reason in English',
    example: 'Account suspended due to violation of terms of service',
    required: false,
  })
  @IsString()
  @IsOptional()
  status_message_en?: string;

  @ApiProperty({
    description: 'Suspension reason in French',
    example: 'Compte suspendu en raison de violation des conditions de service',
    required: false,
  })
  @IsString()
  @IsOptional()
  status_message_fr?: string;
}

export class AdminSuspendUserResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'User suspended successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Updated user information',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      is_suspended: { type: 'boolean', example: true },
      status_message_en: {
        type: 'string',
        example: 'Account suspended due to violation of terms of service',
        nullable: true,
      },
      status_message_fr: {
        type: 'string',
        example:
          'Compte suspendu en raison de violation des conditions de service',
        nullable: true,
      },
    },
  })
  user!: {
    id: string;
    is_suspended: boolean;
    status_message_en: string | null;
    status_message_fr: string | null;
  };
}
