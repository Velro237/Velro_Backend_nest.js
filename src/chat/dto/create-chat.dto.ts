import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

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
}
