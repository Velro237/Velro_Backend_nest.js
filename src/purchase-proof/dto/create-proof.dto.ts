import { IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProofDto {
  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ type: Number, description: 'Total amount on receipt' })
  total?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    type: String,
    description: 'Currency code (e.g., EUR)',
  })
  currency?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Store or merchant name' })
  storeName?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    type: String,
    description: 'Purchase date (ISO string)',
  })
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Additional notes' })
  notes?: string;
}
