import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsEnum, IsArray } from 'class-validator';
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
    description: 'Message content (optional if images are provided)',
    example: 'Hello everyone!',
    required: false,
  })
  @IsOptional()
  @IsString()
  content?: string;

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
    description: 'Array of base64 encoded images to upload',
    type: [String],
    required: false,
    example: [
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

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
    firstName: string | null;
    lastName: string | null;
  };

  @ApiProperty({
    description: 'Message content',
    example: 'Hello everyone!',
  })
  content: string | null;

  @ApiProperty({
    description: 'Array of uploaded image URLs',
    type: [String],
    required: false,
    example: [
      'https://res.cloudinary.com/example/image/upload/v1234567890/velro/image1.jpg',
      'https://res.cloudinary.com/example/image/upload/v1234567890/velro/image2.jpg',
    ],
  })
  imageUrls?: string[] | null;

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
    description: 'Message last update timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Additional message data (JSON)',
    example: { status: 'PENDING' },
    required: false,
  })
  data?: Record<string, any> | null;

  @ApiProperty({
    description: 'Trip data for REQUEST type messages',
    required: false,
  })
  tripData?: {
    id: string;
    pickup: any;
    departure: any;
    destination: any;
    departure_date: Date;
    departure_time: string;
    currency: string;
    airline_id: string;
    user?: {
      id: string;
      email: string;
      name: string;
      firstName: string | null;
      lastName: string | null;
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
      trip_item?: {
        id: string;
        name: string;
        description: string | null;
        image_id?: string | null;
        createdAt?: Date;
        updatedAt?: Date;
        translations?: Array<{
          id: string;
          language: string;
          name: string;
          description: string | null;
        }>;
      };
    }>;
    user?: {
      id: string;
      email: string;
      name: string;
      firstName: string | null;
      lastName: string | null;
      picture: string | null;
    };
  };

  @ApiProperty({
    description: 'Review data for REVIEW type messages',
    required: false,
  })
  reviewData?: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    updatedAt: Date;
    giver: {
      id: string;
      email: string;
      name: string;
      firstName: string | null;
      lastName: string | null;
    };
    receiver: {
      id: string;
      email: string;
      name: string;
      firstName: string | null;
      lastName: string | null;
    };
    trip?: {
      id: string;
      pickup: any;
      departure: any;
      destination: any;
    };
    request?: {
      id: string;
      status: string;
    };
  };
}
