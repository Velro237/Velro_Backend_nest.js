import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

export class RateRequestDto {
  @ApiProperty({
    description: 'Request ID to rate',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  @IsNotEmpty()
  requestId: string;

  @ApiProperty({
    description: 'Rating value (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @ApiProperty({
    description: 'Optional comment about the service',
    example: 'Great service! Everything arrived on time.',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RateRequestResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request rated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Rating ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  ratingId: string;

  @ApiProperty({
    description: 'Rating details',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      rating: 5,
      comment: 'Great service!',
      createdAt: '2024-01-15T10:30:00.000Z',
    },
  })
  rating: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    giver: {
      id: string;
      email: string;
      name: string;
    };
    receiver: {
      id: string;
      email: string;
      name: string;
    };
  };
}
