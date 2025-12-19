import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, ValidateIf } from 'class-validator';

export class AdminFlagContentDto {
  @ApiProperty({
    description:
      'Message ID to flag (either messageId or chatId must be provided)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  @ValidateIf((o) => !o.chatId)
  messageId?: string;

  @ApiProperty({
    description:
      'Chat ID to flag (either messageId or chatId must be provided)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  @ValidateIf((o) => !o.messageId)
  chatId?: string;
}

export class AdminFlagContentResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Content flagged successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Type of content that was flagged',
    enum: ['message', 'chat'],
    example: 'message',
  })
  type!: 'message' | 'chat';
}
