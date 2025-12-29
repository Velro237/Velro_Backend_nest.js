import { ApiProperty } from '@nestjs/swagger';
import { ReportType, ReportPriority, ReportStatus, RequestStatus, TripStatus, Currency } from 'generated/prisma';

export class AdminReportUserDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
    nullable: true,
  })
  firstName: string | null;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    nullable: true,
  })
  lastName: string | null;

  @ApiProperty({
    description: 'Latest KYC record',
    type: 'object',
    nullable: true,
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      status: { type: 'string', example: 'APPROVED' },
      provider: { type: 'string', example: 'DIDIT' },
      rejectionReason: { type: 'string', example: null, nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      verifiedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  })
  kyc: {
    id: string;
    status: string;
    provider: string;
    rejectionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    verifiedAt: Date | null;
  } | null;
}

export class AdminGetReportByIdResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Report retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Complete report information with all related data',
    type: 'object',
    additionalProperties: true,
  })
  report: {
    id: string;
    user_id: string;
    reported_id: string;
    reply_to_id: string | null;
    trip_id: string;
    request_id: string | null;
    type: ReportType;
    text: string | null;
    priority: ReportPriority;
    status: ReportStatus;
    data: any | null;
    images: any | null;
    replied_by: string | null;
    created_at: Date;
    updated_at: Date;
    reporter_user: AdminReportUserDto;
    reported_user: AdminReportUserDto;
    trip: {
      id: string;
      user_id: string;
      pickup: any;
      destination: any;
      departure: any;
      delivery: any;
      departure_date: Date;
      departure_time: string;
      arrival_date: Date | null;
      arrival_time: string | null;
      currency: Currency;
      maximum_weight_in_kg: number | null;
      notes: string | null;
      meetup_flexible: boolean;
      status: TripStatus;
      fully_booked: boolean;
      createdAt: Date;
      updatedAt: Date;
      user: AdminReportUserDto;
    };
    request: {
      id: string;
      trip_id: string;
      user_id: string;
      status: RequestStatus;
      message: string | null;
      cost: number | null;
      currency: Currency | null;
      payment_status: string | null;
      payment_intent_id: string | null;
      paid_at: Date | null;
      created_at: Date;
      updated_at: Date;
      sender_confirmed_delivery: boolean;
      traveler_confirmed_delivery: boolean;
      delivered_at: Date | null;
      cancelled_at: Date | null;
      cancellation_type: string | null;
      cancellation_reason: string | null;
      user: AdminReportUserDto;
    } | null;
    replier: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
  };
}

