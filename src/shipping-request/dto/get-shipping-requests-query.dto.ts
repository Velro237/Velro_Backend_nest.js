import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ShippingRequestStatus } from 'generated/prisma';

export class GetShippingRequestsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
  })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page (max 100)',
    example: 10,
    default: 10,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ShippingRequestStatus,
  })
  @IsEnum(ShippingRequestStatus)
  @IsOptional()
  status?: ShippingRequestStatus;
}
