import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';

export enum RequestChatType {
  SHOPPING = 'SHOPPING',
  SHIPPING = 'SHIPPING',
}

export class InitiateRequestChatDto {
  @ApiProperty({
    description: 'Request ID (shopping or shipping request)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID('4')
  requestId: string;

  @ApiProperty({
    description: 'Type of request',
    enum: RequestChatType,
    example: RequestChatType.SHOPPING,
  })
  @IsEnum(RequestChatType)
  requestType: RequestChatType;

  @ApiPropertyOptional({
    description: 'Optional initial message content',
    example: 'Hi! I have some questions about your request.',
  })
  @IsOptional()
  @IsString()
  messageContent?: string;
}
