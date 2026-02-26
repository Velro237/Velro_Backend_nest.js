import { PartialType } from '@nestjs/swagger';
import { CreateMarketplaceOfferDto } from './create-marketplace-offer.dto';

export class UpdateMarketplaceOfferDto extends PartialType(CreateMarketplaceOfferDto) {}
