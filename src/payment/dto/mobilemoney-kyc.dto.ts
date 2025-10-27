import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class MobilemoneyKycDto {
  @ApiProperty({
    description: 'Phone number to check (9 digits for Cameroon)',
    example: '671234567',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{9}$/, {
    message: 'Phone number must be exactly 9 digits',
  })
  phoneNumber: string;
}

export class MobilemoneyKycResponseDto {
  @ApiProperty({
    description: 'KYC verification result from the provider',
    example: {
      phoneNumber: '671234567',
      verified: true,
      name: 'John Doe',
      // ... other KYC data
    },
  })
  data: any;

  @ApiProperty({
    description: 'Success message',
    example: 'KYC check completed successfully',
  })
  message?: string;
}
