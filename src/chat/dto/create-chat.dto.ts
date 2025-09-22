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
    description: 'Array of user IDs to add to the chat',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '987fcdeb-51a2-43d1-b456-426614174000',
    ],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds: string[];
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
