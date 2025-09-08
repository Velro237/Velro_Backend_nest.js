import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateTransportTypeDto {
  @ApiProperty({
    description: 'Transport type name',
    example: 'Airplane',
    uniqueItems: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Transport type description',
    example: 'Commercial airline transportation',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateTransportTypeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Transport type created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created transport type information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Airplane',
      description: 'Commercial airline transportation',
      created_at: '2024-01-15T10:30:00.000Z',
    },
  })
  transportType: {
    id: string;
    name: string;
    description: string | null;
    created_at: Date;
  };
}
