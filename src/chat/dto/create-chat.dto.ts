import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsUUID, IsEnum } from 'class-validator';
import { MessageType } from './send-message.dto';

export class CreateChatDto {
  @ApiProperty({
    description: 'Chat name (optional for direct messages)',
    example: 'Project Discussion',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'User ID to start a direct chat with (only one user allowed)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID('4')
  otherUserId: string;

  @ApiProperty({
    description: 'Trip ID to associate with this chat (optional)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID('4')
  tripId?: string;

  @ApiProperty({
    description:
      'Initial message content (optional - chat can be created without a message)',
    example: 'Hello! I would like to discuss the trip details.',
    required: false,
  })
  @IsOptional()
  @IsString()
  messageContent?: string;

  @ApiProperty({
    description: 'Initial message type',
    enum: MessageType,
    example: MessageType.TEXT,
    default: MessageType.TEXT,
    required: false,
  })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType = MessageType.TEXT;

  @ApiProperty({
    description: 'ID of the message being replied to (optional)',
    example: '987fcdeb-51a2-43d1-b456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  messageReplyToId?: string;

  @ApiProperty({
    description: 'Request ID to link message to a trip request',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  messageRequestId?: string;
}

export class CreateChatResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Chat created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created chat information',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      name: { type: 'string', example: 'Project Discussion' },
      createdAt: { type: 'string', format: 'date-time' },
      members: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  })
  chat: {
    id: string;
    name: string | null;
    createdAt: Date;
    members: Array<{
      id: string;
      email: string;
      role: string;
    }>;
  };

  @ApiPropertyOptional({
    description:
      'Last message that was created with the chat (null if chat was created without a message)',
    type: 'object',
    nullable: true,
    properties: {
      id: { type: 'string' },
      content: { type: 'string' },
      type: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      sender: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  })
  lastMessage: {
    id: string;
    content: string;
    type: string;
    createdAt: Date;
    sender: {
      id: string;
      email: string;
    };
  } | null;
}
