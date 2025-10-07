import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAirlineDto {
  @ApiProperty({
    description: 'Airline name',
    example: 'American Airlines',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Airline description (optional)',
    example: 'Major US airline serving domestic and international routes',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateAirlineResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Airline created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created airline information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'American Airlines',
      description: 'Major US airline serving domestic and international routes',
      created_at: '2024-01-15T10:30:00.000Z',
    },
  })
  airline: {
    id: string;
    name: string;
    description?: string;
    created_at: Date;
  };
}
