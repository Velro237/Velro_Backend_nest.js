import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsUUID,
  IsNotEmpty,
  IsPositive,
} from 'class-validator';

export class TripItemListDto {
  @ApiProperty({
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  trip_item_id: string;

  @ApiProperty({
    description: 'Price for this trip item',
    example: 15.5,
    type: 'number',
  })
  @IsNumber()
  @IsPositive()
  price: number;
}
