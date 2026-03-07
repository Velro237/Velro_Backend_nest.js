import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { RequestStatus } from 'generated/prisma';
import { Transform } from 'class-transformer';

export class ChangeRequestStatusDto {
  @ApiProperty({
    description: 'Request ID to update',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  requestId: string;

  @ApiProperty({
    description: 'New status for the request',
    enum: RequestStatus,
    example: RequestStatus.ACCEPTED,
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    const normalized = value.trim().toUpperCase();
    const aliases: Record<string, RequestStatus> = {
      ACCEPT: RequestStatus.ACCEPTED,
      APPROVE: RequestStatus.ACCEPTED,
      APPROVED: RequestStatus.ACCEPTED,
      REJECT: RequestStatus.DECLINED,
      REJECTED: RequestStatus.DECLINED,
      DECLINE: RequestStatus.DECLINED,
      CONFIRM: RequestStatus.CONFIRMED,
      SHIPPED: RequestStatus.SENT,
    };

    return aliases[normalized] || normalized;
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
