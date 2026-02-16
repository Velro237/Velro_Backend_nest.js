import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

function toPositiveIntOrUndefined(value: any) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isNaN(n) ? undefined : n;
}

export class GetShoppingRequestQueryDto {
  @ApiPropertyOptional({
    description: 'Offers page number (1-based)',
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => toPositiveIntOrUndefined(value))
  @IsInt()
  @Min(1)
  offersPage?: number;

  @ApiPropertyOptional({
    description: 'Offers page size (defaults to 3)',
    default: 3,
  })
  @IsOptional()
  @Transform(({ value }) => toPositiveIntOrUndefined(value))
  @IsInt()
  @Min(1)
  offersLimit?: number;
}
