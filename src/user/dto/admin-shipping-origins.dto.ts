import { ApiProperty } from '@nestjs/swagger';

export class ShippingOriginDto {
  @ApiProperty({
    description: 'Departure country name',
    example: 'United States',
  })
  country!: string;

  @ApiProperty({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'US',
    required: false,
  })
  country_code?: string | null;

  @ApiProperty({
    description: 'Number of unique users who created trips from this country',
    example: 45,
  })
  user_count!: number;

  @ApiProperty({
    description: 'Total number of trips from this country',
    example: 120,
  })
  trip_count!: number;
}

export class AdminShippingOriginsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Shipping origins retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'List of shipping origins (departure countries) with user and trip counts',
    type: [ShippingOriginDto],
  })
  data!: ShippingOriginDto[];
}

