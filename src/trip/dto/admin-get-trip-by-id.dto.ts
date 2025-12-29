import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus, Currency } from 'generated/prisma';

export class AdminTripRequestItemDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  trip_item_id: string;

  @ApiProperty({
    description: 'Item name',
    example: 'Electronics',
  })
  name: string;

  @ApiProperty({
    description: 'Quantity requested',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Total weight in kg',
    example: 5.5,
    nullable: true,
  })
  total_kg: number | null;
}

export class AdminTripRequestDto {
  @ApiProperty({
    description: 'Request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User who made the request',
    type: Object,
    additionalProperties: true,
  })
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    kyc: {
      id: string;
      status: string;
      provider: string;
      rejectionReason: string | null;
      createdAt: Date;
      updatedAt: Date;
      verifiedAt: Date | null;
    } | null;
  };

  @ApiProperty({
    description: 'Items requested',
    type: [AdminTripRequestItemDto],
  })
  items: AdminTripRequestItemDto[];

  @ApiProperty({
    description: 'Total weight in kg',
    example: 10.5,
    nullable: true,
  })
  total_kg: number | null;

  @ApiProperty({
    description: 'Cost in EUR',
    example: 150.5,
    nullable: true,
  })
  cost_eur: number | null;

  @ApiProperty({
    description: 'Request status',
    enum: RequestStatus,
    example: RequestStatus.CONFIRMED,
  })
  status: RequestStatus;
}

export class AdminTripUserDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

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
    description: 'Email',
    example: 'john.doe@example.com',
  })
  email: string;
}

export class AdminGetTripByIdResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Trip information',
    type: Object,
    additionalProperties: true,
  })
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
    mode_of_transport_id: string | null;
    airline_id: string;
    maximum_weight_in_kg: number | null;
    notes: string | null;
    meetup_flexible: boolean;
    status: string;
    fully_booked: boolean;
    createdAt: Date;
    updatedAt: Date;
    user?: {
      id: string;
      email: string;
      name: string;
      firstName: string | null;
      lastName: string | null;
      picture: string | null;
      role: string;
      kyc: {
        id: string;
        status: string;
        provider: string;
        rejectionReason: string | null;
        createdAt: Date;
        updatedAt: Date;
        verifiedAt: Date | null;
      } | null;
    };
    mode_of_transport?: {
      id: string;
      name: string;
      description: string | null;
    };
    airline?: {
      id: string;
      name: string;
      description: string | null;
    };
    trip_items?: any[];
  };

  @ApiProperty({
    description: 'Total on hold trip earnings in EUR',
    example: 500.75,
  })
  total_on_hold_trip_earning_eur: number;

  @ApiProperty({
    description:
      'Total withdrawable trip earnings in EUR (earnings in available balance)',
    example: 1200.5,
  })
  total_withdrawable_trip_earnings_eur: number;

  @ApiProperty({
    description: 'Total trip earnings in EUR (withdrawable + hold)',
    example: 1701.25,
  })
  total_trip_earning_eur: number;

  @ApiProperty({
    description:
      'Percentage of total on hold trip earnings relative to total withdrawable earnings',
    example: 29.41,
  })
  total_on_hold_trip_earning_eur_percentage: number;

  @ApiProperty({
    description:
      'Percentage of total trip earnings relative to total withdrawable earnings',
    example: 141.77,
  })
  total_trip_earning_eur_percentage: number;

  @ApiProperty({
    description: 'List of unique users who requested the trip',
    type: [AdminTripUserDto],
  })
  users_who_requested: AdminTripUserDto[];

  @ApiProperty({
    description: 'List of requests on the trip',
    type: [AdminTripRequestDto],
  })
  requests: AdminTripRequestDto[];
}
