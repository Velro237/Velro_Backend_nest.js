import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AdminSendWarningDto {
  @ApiProperty({
    description: 'Chat ID to send warning to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  chatId!: string;

  @ApiProperty({
    description: 'Warning message content',
    example: 'Please follow our community guidelines',
  })
  @IsString()
  message!: string;
}

export class AdminSendWarningResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Warning sent successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'The warning message that was sent',
  })
  warningMessage!: {
    id: string;
    chatId: string;
    content: string;
    type: string;
    createdAt: Date;
  };
}
