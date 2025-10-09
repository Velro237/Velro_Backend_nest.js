import { ApiProperty } from '@nestjs/swagger';

export class GetMeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Hello, user!',
  })
  message: string;

  @ApiProperty({
    description: 'Complete user information including KYC record',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      picture: 'https://example.com/profile.jpg',
      device_id: 'device-123',
      role: 'USER',
      isFreightForwarder: false,
      companyName: null,
      companyAddress: null,
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-16T14:30:00.000Z',
      kycRecord: {
        id: 'kyc-123',
        status: 'VERIFIED',
        provider: 'DIDIT',
        rejectionReason: null,
        createdAt: '2024-01-10T10:00:00.000Z',
        updatedAt: '2024-01-10T10:00:00.000Z',
      },
    },
  })
  user: {
    id: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    picture?: string;
    device_id?: string;
    role: string;
    isFreightForwarder?: boolean;
    companyName?: string;
    companyAddress?: string;
    createdAt: Date;
    updatedAt: Date;
    kycRecord?: {
      id: string;
      status: string;
      provider: string;
      rejectionReason?: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  };
}
