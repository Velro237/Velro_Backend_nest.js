import { ApiProperty } from '@nestjs/swagger';

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
    description: `Current verification status (official Didit statuses):
      NOT_STARTED: The verification process has not been initiated by the user yet
      IN_PROGRESS: The user has started the verification process and is currently submitting information
      APPROVED: The verification has been successfully completed and approved
      DECLINED: The verification has been rejected due to issues with submitted information
      KYC_EXPIRED: The previously verified KYC has expired and needs to be renewed
      IN_REVIEW: The verification requires manual review by the compliance team
      EXPIRED: The verification session has timed out before completion
      ABANDONED: The user started but did not complete the verification process`,
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
    description: 'Verification creation timestamp',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Verification completion timestamp',
    example: '2024-01-01T12:05:00Z',
    required: false,
  })
  verifiedAt?: Date;

  @ApiProperty({
    description: 'Session expiration timestamp',
    example: '2024-01-01T23:59:59Z',
    required: false,
  })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Rejection reason if applicable',
    example: 'Document quality too low',
    required: false,
  })
  rejectionReason?: string;
}
