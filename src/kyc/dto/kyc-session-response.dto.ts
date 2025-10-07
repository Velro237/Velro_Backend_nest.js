import { ApiProperty } from '@nestjs/swagger';

export class KycSessionResponseDto {
  @ApiProperty({
    description: 'Didit session ID',
    example: '11111111-2222-3333-4444-555555555555',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Didit session number',
    example: 1234,
  })
  sessionNumber: number;

  @ApiProperty({
    description: 'Didit session token',
    example: 'abcdef123456',
  })
  sessionToken: string;

  @ApiProperty({
    description: 'Vendor data (user ID)',
    example: 'user-123',
  })
  vendorData: string;

  @ApiProperty({
    description: 'Session metadata',
    example: '{"user_type": "premium", "account_id": "ABC123"}',
    required: false,
  })
  metadata?: any;

  @ApiProperty({
    description: 'Current session status',
    example: 'Not Started',
  })
  status: string;

  @ApiProperty({
    description: 'Didit workflow ID',
    example: '11111111-2222-3333-4444-555555555555',
  })
  workflowId: string;

  @ApiProperty({
    description: 'Callback URL',
    example: 'https://example.com/verification/callback',
  })
  callback: string;

  @ApiProperty({
    description: 'URL to open in WebView for verification',
    example: 'https://verify.didit.me/session/abcdef123456',
  })
  url: string;

  @ApiProperty({
    description: 'Local database record ID',
    example: 'kyc_123456789',
  })
  recordId: string;

  @ApiProperty({
    description: 'Local session expiration timestamp',
    example: '2024-01-01T23:59:59Z',
  })
  expiresAt: string;
}

export class KycStatusDto {
  @ApiProperty({
    description: 'KYC record ID',
    example: 'kyc_123456789',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: 'user_123456789',
  })
  userId: string;

  @ApiProperty({
    description: 'Current verification status (official Didit statuses)',
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'APPROVED', 'DECLINED', 'KYC_EXPIRED', 'IN_REVIEW', 'EXPIRED', 'ABANDONED'],
    example: 'APPROVED',
  })
  status: string;

  @ApiProperty({
    description: 'KYC provider',
    enum: ['DIDIT', 'OTHER'],
    example: 'DIDIT',
  })
  provider: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Verification completion timestamp',
    example: '2024-01-01T12:00:00Z',
    required: false,
  })
  verifiedAt?: Date | null;

  @ApiProperty({
    description: 'Session expiration timestamp',
    example: '2024-01-02T00:00:00Z',
    required: false,
  })
  expiresAt?: Date | null;

  @ApiProperty({
    description: 'Rejection reason if applicable',
    example: 'Document quality too low',
    required: false,
  })
  rejectionReason?: string | null;
}
