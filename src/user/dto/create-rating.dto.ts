import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({
    description: 'ID of the user being rated',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  receiver_id!: string;

  @ApiProperty({
    description: 'ID of the trip being rated',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  @IsUUID()
  trip_id!: string;

  @ApiProperty({
    description: 'ID of the specific request being rated (optional)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  request_id?: string;

  @ApiProperty({
    description: 'Rating value from 1 to 5',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({
    description: 'Optional comment about the rating',
    example: 'Great communication and punctuality. Highly recommended!',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateRatingResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Rating created successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Created rating details',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174003',
      },
      giver_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174004',
      },
      receiver_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174000',
      },
      trip_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174001',
      },
      request_id: {
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174002',
        nullable: true,
      },
      rating: {
        type: 'number',
        example: 5,
      },
      comment: {
        type: 'string',
        example: 'Great communication and punctuality. Highly recommended!',
        nullable: true,
      },
      created_at: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  rating!: {
    id: string;
    giver_id: string;
    receiver_id: string;
    trip_id: string;
    request_id: string | null;
    rating: number;
    comment: string | null;
    created_at: Date;
  };
}
