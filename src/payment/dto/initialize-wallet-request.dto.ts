import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class InitializeWalletRequestDto {
  @ApiProperty({
    description: 'Currency code for the wallet (e.g., USD, EUR, XAF)',
    example: 'XAF',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  currency: string;
}
