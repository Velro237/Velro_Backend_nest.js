import { PartialType } from '@nestjs/swagger';
import { CreateMarketplaceListingDtoBase } from './create-marketplace-listing.dto';

export class UpdateMarketplaceListingDto extends PartialType(
  CreateMarketplaceListingDtoBase,
) {}
