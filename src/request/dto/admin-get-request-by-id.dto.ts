import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus, Currency, TransactionStatus, TransactionType, TransactionSource, TransactionProvider } from 'generated/prisma';

export class TransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  trip_id: string | null;

  @ApiProperty({
    description: 'Request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  request_id: string | null;

  @ApiProperty({
    description: 'Amount requested',
    example: 100.0,
  })
  amount_requested: number;

  @ApiProperty({
    description: 'Fee applied',
    example: 5.0,
  })
  fee_applied: number;

  @ApiProperty({
    description: 'Amount paid',
    example: 95.0,
  })
  amount_paid: number;

  @ApiProperty({
    description: 'Wallet ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  wallet_id: string;

  @ApiProperty({
    description: 'Currency',
    example: 'EUR',
    enum: Currency,
  })
  currency: string;

  @ApiProperty({
    description: 'Status message',
    example: 'Transaction completed',
    required: false,
  })
  status_message: string | null;

  @ApiProperty({
    description: 'Description',
    example: 'Payment for trip request',
    required: false,
  })
  description: string | null;

  @ApiProperty({
    description: 'Metadata',
    example: { key: 'value' },
    required: false,
  })
  metadata: any;

  @ApiProperty({
    description: 'Reference',
    example: 'REF123456',
    required: false,
  })
  reference: string | null;

  @ApiProperty({
    description: 'Balance after transaction',
    example: 500.0,
    required: false,
  })
  balance_after: number | null;

  @ApiProperty({
    description: 'Created at',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Processed at',
    example: '2024-01-15T10:05:00.000Z',
    required: false,
  })
  processedAt: Date | null;

  @ApiProperty({
    description: 'Updated at',
    example: '2024-01-15T10:05:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionType,
    example: TransactionType.DEBIT,
  })
  type: TransactionType;

  @ApiProperty({
    description: 'Transaction source',
    enum: TransactionSource,
    example: TransactionSource.ORDER,
  })
  source: TransactionSource;

  @ApiProperty({
    description: 'Transaction status',
    enum: TransactionStatus,
    example: TransactionStatus.SUCCESS,
  })
  status: TransactionStatus;

  @ApiProperty({
    description: 'Transaction provider',
    enum: TransactionProvider,
    example: TransactionProvider.STRIPE,
  })
  provider: TransactionProvider;

  @ApiProperty({
    description: 'Provider ID',
    example: 'pi_1234567890',
    required: false,
  })
  provider_id: string | null;

  @ApiProperty({
    description: 'Stripe transfer ID',
    example: 'tr_1234567890',
    required: false,
  })
  stripe_transfer_id: string | null;

  @ApiProperty({
    description: 'Stripe account ID',
    example: 'acct_1234567890',
    required: false,
  })
  stripe_account_id: string | null;

  @ApiProperty({
    description: 'Phone number',
    example: '+1234567890',
    required: false,
  })
  phone_number: string | null;
}

export class AdminGetRequestByIdResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request details retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Request details with currency in EUR and all transactions',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      trip_id: '123e4567-e89b-12d3-a456-426614174001',
      user_id: '123e4567-e89b-12d3-a456-426614174002',
      status: 'CONFIRMED',
      message: 'Please handle with care',
      cost: 150.0,
      cost_eur: 138.5,
      currency: 'EUR',
      payment_status: 'SUCCEEDED',
      payment_intent_id: 'pi_1234567890',
      paid_at: '2024-01-15T10:00:00.000Z',
      created_at: '2024-01-15T09:00:00.000Z',
      updated_at: '2024-01-15T10:00:00.000Z',
      sender_confirmed_delivery: false,
      traveler_confirmed_delivery: false,
      delivered_at: null,
      cancelled_at: null,
      cancellation_type: null,
      cancellation_reason: null,
      chat_id: '123e4567-e89b-12d3-a456-426614174003',
      is_deleted: false,
      user: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        email: 'user@example.com',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        picture: 'https://example.com/avatar.jpg',
      },
      trip: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        user_id: '123e4567-e89b-12d3-a456-426614174006',
        pickup: { country: 'France', city: 'Paris', address: '123 Main St' },
        departure: { country: 'France', city: 'Paris' },
        destination: { country: 'USA', city: 'New York' },
        departure_date: '2024-02-15T10:00:00.000Z',
        status: 'PUBLISHED',
        user: {
          id: '123e4567-e89b-12d3-a456-426614174006',
          email: 'traveler@example.com',
          name: 'Jane Traveler',
          firstName: 'Jane',
          lastName: 'Traveler',
          picture: 'https://example.com/traveler.jpg',
        },
      },
      request_items: [
        {
          trip_item_id: '123e4567-e89b-12d3-a456-426614174004',
          quantity: 2,
          special_notes: 'Handle with care',
          trip_item: {
            id: '123e4567-e89b-12d3-a456-426614174004',
            name: 'Electronics',
            description: 'Electronic devices',
            image: {
              id: '123e4567-e89b-12d3-a456-426614174007',
              url: 'https://example.com/electronics.jpg',
              alt_text: 'Electronics image',
            },
            translations: [],
          },
        },
      ],
      transactions: [
        {
          id: '123e4567-e89b-12d3-a456-426614174005',
          userId: '123e4567-e89b-12d3-a456-426614174002',
          amount_requested: 150.0,
          amount_paid: 145.0,
          fee_applied: 5.0,
          currency: 'EUR',
          status: 'SUCCESS',
          type: 'DEBIT',
          source: 'ORDER',
          provider: 'STRIPE',
          createdAt: '2024-01-15T10:00:00.000Z',
        },
      ],
    },
  })
  request: {
    id: string;
    trip_id: string;
    user_id: string;
    status: RequestStatus;
    message: string | null;
    cost: number | null;
    cost_eur: number | null;
    currency: string;
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
    chat_id: string | null;
    is_deleted: boolean;
    user: {
      id: string;
      email: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      picture: string | null;
    };
    trip: {
      id: string;
      user_id: string;
      pickup: any;
      departure: any;
      destination: any;
      departure_date: Date;
      status: string;
      user: {
        id: string;
        email: string;
        name: string | null;
        firstName: string | null;
        lastName: string | null;
        picture: string | null;
      };
    };
    request_items: Array<{
      trip_item_id: string;
      quantity: number;
      special_notes: string | null;
      trip_item: {
        id: string;
        name: string;
        description: string | null;
        image: {
          id: string;
          url: string;
          alt_text: string | null;
        } | null;
        translations: Array<{
          id: string;
          language: string;
          name: string;
          description: string | null;
        }>;
      } | null;
    }>;
    transactions: TransactionDto[];
  };
}

