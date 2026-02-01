import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ShoppingRequestStatus } from 'generated/prisma';

export class GetShoppingRequestsQueryDto {
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
    enum: ShoppingRequestStatus,
  })
  @IsEnum(ShoppingRequestStatus)
  @IsOptional()
  status?: ShoppingRequestStatus;

  @ApiPropertyOptional({
    description:
      'Filter by request type: "my_requests" for requests I created, "available" for requests I can make offers on',
  })
  @IsOptional()
  @IsEnum(['my_requests', 'available'])
  type?: 'my_requests' | 'available';
}
