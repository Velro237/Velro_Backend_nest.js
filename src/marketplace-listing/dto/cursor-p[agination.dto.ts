import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CursorPaginationQueryDto {
  @IsOptional()
  @IsString()
  @ApiProperty()
  cursor: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  @Min(1)
  @Max(100)
  @ApiProperty({ type: Number })
  limit: number;
}
