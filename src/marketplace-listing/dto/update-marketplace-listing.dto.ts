import { PartialType } from '@nestjs/swagger';
import { CreateMarketplaceListingDto } from './create-marketplace-listing.dto';

export class UpdateMarketplaceListingDto extends PartialType(CreateMarketplaceListingDto) {}
