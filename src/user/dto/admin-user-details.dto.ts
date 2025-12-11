import { ApiProperty } from '@nestjs/swagger';

export class AdminUserDetailsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'User details retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'User details with statistics',
    type: 'object',
    properties: {
      // User basic info
      id: { type: 'string', example: 'user_123' },
      email: { type: 'string', example: 'user@example.com' },
      username: { type: 'string', example: 'johndoe', nullable: true },
      firstName: { type: 'string', example: 'John', nullable: true },
      lastName: { type: 'string', example: 'Doe', nullable: true },
      phone: { type: 'string', example: '+1234567890', nullable: true },
      address: { type: 'string', example: '123 Main St', nullable: true },
      city: { type: 'string', example: 'New York', nullable: true },
      state: { type: 'string', example: 'NY', nullable: true },
      zip: { type: 'string', example: '10001', nullable: true },
      picture: {
        type: 'string',
        example: 'https://example.com/avatar.png',
        nullable: true,
      },
      name: { type: 'string', example: 'John Doe', nullable: true },
      isFreightForwarder: { type: 'boolean', example: false },
      companyName: { type: 'string', example: 'ABC Corp', nullable: true },
      companyAddress: {
        type: 'string',
        example: '456 Business Ave',
        nullable: true,
      },
      businessType: { type: 'string', example: 'Logistics', nullable: true },
      currency: { type: 'string', example: 'EUR', nullable: true },
      lang: { type: 'string', example: 'en', nullable: true },
      date_of_birth: { type: 'string', format: 'date-time', nullable: true },
      role: { type: 'string', example: 'USER', enum: ['USER', 'ADMIN'] },
      is_suspended: { type: 'boolean', example: false },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      // Services and cities
      services: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
          },
        },
      },
      cities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            address: { type: 'string' },
            contactName: { type: 'string' },
            contactPhone: { type: 'string' },
          },
        },
      },
      kycRecords: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            provider: { type: 'string' },
            rejectionReason: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      // Statistics
      averageRating: {
        type: 'number',
        example: 4.5,
        description: 'Average rating out of 5',
      },
      totalRatings: {
        type: 'number',
        example: 12,
        description: 'Total number of ratings received',
      },
      totalTrips: {
        type: 'number',
        example: 25,
        description: 'Total trips created by user',
      },
      totalRequestsSent: {
        type: 'number',
        example: 50,
        description: 'Total requests sent by user',
      },
      totalRequestsCompleted: {
        type: 'number',
        example: 30,
        description: 'Total requests completed (DELIVERED, REVIEWED)',
      },
      totalRequestsReviewed: {
        type: 'number',
        example: 25,
        description: 'Total requests reviewed (REVIEWED status)',
      },
    },
  })
  user!: {
    id: string;
    email: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    picture?: string | null;
    name?: string | null;
    isFreightForwarder: boolean;
    companyName?: string | null;
    companyAddress?: string | null;
    businessType?: string | null;
    currency?: string | null;
    lang?: string | null;
    date_of_birth?: Date | null;
    role: string;
    is_suspended: boolean;
    createdAt: Date;
    updatedAt: Date;
    services: Array<{
      id: string;
      name: string;
      description?: string | null;
    }>;
    cities: Array<{
      id: string;
      name: string;
      address: string;
      contactName: string;
      contactPhone: string;
    }>;
    kycRecords: Array<{
      id: string;
      status: string;
      provider: string;
      rejectionReason?: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    averageRating: number;
    totalRatings: number;
    totalTrips: number;
    totalRequestsSent: number;
    totalRequestsCompleted: number;
    totalRequestsReviewed: number;
  };
}
