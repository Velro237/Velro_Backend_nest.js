import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OfferStatus } from 'generated/prisma';
import { PaginationQueryDto } from 'src/wallet/dto/wallet.dto';

export class GetUserShippingOffersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: OfferStatus,
    example: OfferStatus.PENDING,
  })
  @IsEnum(OfferStatus)
  @IsOptional()
  status: OfferStatus;
}
