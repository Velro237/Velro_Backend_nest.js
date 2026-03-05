import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ShoppingRequestStatus } from 'generated/prisma';
import { PaginationQueryDto } from 'src/wallet/dto/wallet.dto';

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
    description: 'Filter by destination (matches deliver_to)',
  })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation date (ISO date, e.g. 2026-02-16)',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value ? String(value) : undefined))
  date?: string;

  @ApiPropertyOptional({
    description:
      'Filter by request type: "my_requests" for requests I created, "available" for requests I can make offers on',
  })
  @IsOptional()
  @IsEnum(['my_requests', 'available'])
  type?: 'my_requests' | 'available';
}

export class GetUserShoppingRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ShoppingRequestStatus,
  })
  @IsEnum(ShoppingRequestStatus)
  @IsOptional()
  status?: ShoppingRequestStatus;
}
