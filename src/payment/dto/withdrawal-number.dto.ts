import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsIn,
} from 'class-validator';

export class CreateWithdrawalNumberDto {
  @ApiProperty({
    description: 'Mobile phone number (9 characters)',
    example: '678901234',
    minLength: 9,
    maxLength: 9,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(9)
  number: string;

  @ApiProperty({
    description: 'Name of the person who owns the phone number',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateWithdrawalNumberDto {
  @ApiProperty({
    description: 'Mobile phone number (9 characters)',
    example: '678901234',
    minLength: 9,
    maxLength: 9,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(9)
  number: string;

  @ApiProperty({
    description: 'Name of the person who owns the phone number',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class WithdrawalNumberDto {
  @ApiProperty({
    description: 'Withdrawal number ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Mobile phone number',
    example: '678901234',
  })
  number: string;

  @ApiProperty({
    description: 'Carrier (MTN or ORANGE)',
    example: 'MTN',
    enum: ['MTN', 'ORANGE'],
  })
  carrier: string;

  @ApiProperty({
    description: 'Name of the person who owns the phone number',
    example: 'John Doe',
  })
  name: string;
}

export class WithdrawalNumberListDto {
  @ApiProperty({
    description: 'List of withdrawal numbers',
    type: [WithdrawalNumberDto],
  })
  withdrawalNumbers: WithdrawalNumberDto[];
}

export class DeleteWithdrawalNumberResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Success message',
    example: 'Withdrawal number deleted successfully',
  })
  message: string;
}

export class GetWithdrawalNumbersQueryDto {
  @ApiProperty({
    description:
      'Filter by carrier (MTN, ORANGE, or ALL). Defaults to ALL if not provided',
    example: 'MTN',
    enum: ['MTN', 'ORANGE', 'ALL'],
    required: false,
    default: 'ALL',
  })
  @IsOptional()
  @IsString()
  @IsIn(['MTN', 'ORANGE', 'ALL'])
  carrier?: 'MTN' | 'ORANGE' | 'ALL' = 'ALL';
}
