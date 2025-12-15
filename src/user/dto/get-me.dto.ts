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
      username: 'johndoe',
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
      businessType: 'Logistics',
      currency: 'XAF',
      lang: 'en',
      date_of_birth: '1990-01-01T00:00:00.000Z',
      stripe_account_id: 'acct_1234567890',
      payout_country: 'CM',
      payout_currency: 'EUR',
      transfers_capability: 'active',
      stripe_onboarding_complete: true,
      push_notification: true,
      email_notification: true,
      sms_notification: true,
      services: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Logistics',
          description: 'Full logistics services',
        },
      ],
      cities: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Paris Office',
          address: '123 Main St, Paris',
          contactName: 'John Doe',
          contactPhone: '+1234567890',
        },
      ],
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
    username?: string | null;
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
    businessType?: string;
    currency?: string | null;
    lang?: string | null;
    date_of_birth?: Date | null;
    stripe_account_id?: string | null;
    payout_country?: string | null;
    payout_currency?: string | null;
    transfers_capability?: string | null;
    stripe_onboarding_complete?: boolean | null;
    push_notification?: boolean;
    email_notification?: boolean;
    sms_notification?: boolean;
    services?: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
    cities?: Array<{
      id: string;
      name: string;
      address: string;
      contactName: string;
      contactPhone: string;
    }>;
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
