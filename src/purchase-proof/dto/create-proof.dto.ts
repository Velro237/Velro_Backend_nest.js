import { IsOptional, IsString, IsNumber, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PurchaseProofFilesDto {
  @IsOptional()
  @IsArray()
  receipt: Express.Multer.File[];

  @IsOptional()
  @IsArray()
  photos: Express.Multer.File[];
}

export class CreateProofDto {
  @IsOptional()
  @Type(() => Number)
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
