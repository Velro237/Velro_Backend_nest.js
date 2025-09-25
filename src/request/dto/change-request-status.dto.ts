import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { RequestStatus } from 'generated/prisma';

export class ChangeRequestStatusDto {
  @ApiProperty({
    description: 'Chat ID where the status change message will be sent',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  chatId: string;

  @ApiProperty({
    description: 'New status for the request',
    enum: RequestStatus,
    example: RequestStatus.APPROVED,
  })
  @IsEnum(RequestStatus)
  status: RequestStatus;
}

export class ChangeRequestStatusResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request status updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated request data',
    type: 'object',
    additionalProperties: true,
  })
  request: {
    id: string;
    status: RequestStatus;
    updatedAt: Date;
  };

  @ApiProperty({
    description: 'Message sent to chat',
    type: 'object',
    additionalProperties: true,
  })
  chatMessage: {
    id: string;
    chatId: string;
    content: string;
    type: string;
    createdAt: Date;
  };
}
