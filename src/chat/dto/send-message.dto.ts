import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsEnum } from 'class-validator';
import { MessageType as PrismaMessageType } from 'generated/prisma';

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  REQUEST = 'REQUEST',
  PAYMENT = 'PAYMENT',
}

export class SendMessageDto {
  @ApiProperty({
    description: 'Chat ID where the message will be sent',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  chatId: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello everyone!',
  })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Message type',
    enum: MessageType,
    example: MessageType.TEXT,
    default: MessageType.TEXT,
  })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType = MessageType.TEXT;

  @ApiProperty({
    description: 'ID of the message being replied to (optional)',
    example: '987fcdeb-51a2-43d1-b456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  replyToId?: string;

  @ApiProperty({
    description: 'Image URL for image messages',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Request ID to link message to a trip request',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  requestId?: string;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Message ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Chat ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  chatId: string;

  @ApiProperty({
    description: 'Sender information',
    type: 'object',
    properties: {
      id: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
    },
  })
  sender: {
    id: string;
    email: string;
    name: string;
  };

  @ApiProperty({
    description: 'Message content',
    example: 'Hello everyone!',
  })
  content: string | null;

  @ApiProperty({
    description: 'Image URL',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  imageUrl: string | null;

  @ApiProperty({
    description: 'Message type',
    enum: MessageType,
    example: MessageType.TEXT,
  })
  type: PrismaMessageType;

  @ApiProperty({
    description: 'Whether the message has been read',
    example: false,
  })
  isRead: boolean;

  @ApiProperty({
    description: 'Message creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Trip data for REQUEST type messages',
    required: false,
  })
  tripData?: {
    id: string;
    pickup: any;
    destination: any;
    departure_date: Date;
    departure_time: string;
    currency: string;
    airline_id: string;
    user?: {
      id: string;
      email: string;
    };
  };

  @ApiProperty({
    description: 'Request data for REQUEST type messages',
    required: false,
  })
  requestData?: {
    id: string;
    status: string;
    message?: string;
    cost: number | null;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
    availableKgs: number;
    requestItems: Array<{
      quantity: number;
      specialNotes: string | null;
      tripItem?: {
        id: string;
        name: string;
        description: string | null;
      };
    }>;
    user?: {
      id: string;
      email: string;
      name: string;
      picture: string | null;
    };
  };
}
