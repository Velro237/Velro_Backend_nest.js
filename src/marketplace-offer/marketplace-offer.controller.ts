import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { MarketplaceOfferService } from './marketplace-offer.service';
import { CreateMarketplaceOfferDto } from './dto/create-marketplace-offer.dto';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthConstants } from 'src/shared/constants';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { PaginationQueryDto } from 'src/wallet/dto/wallet.dto';

@ApiTags('Marketplace', 'Offer')
@ApiExtraModels(CreateMarketplaceOfferDto)
@Controller({
  path: 'marketplace/offer',
  version: '1',
})
@ApiBearerAuth(AuthConstants.SWAGGER_BEARER_TOKEN_KEY)
@UseGuards(JwtAuthGuard)
export class MarketplaceOfferController {
  constructor(
    private readonly marketplaceOfferService: MarketplaceOfferService,
  ) {}

  @Post('/listing/:listingId')
  @ApiOperation({
    summary: 'Create a new marketplace listing',
  })
  @ApiParam({
    name: 'listingId',
    description: 'The listing id',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The offer has been successfully created.',
    // type: MarketplaceListingDto,
  })
  create(
    @Param('listingId') listingId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMarketplaceOfferDto,
  ) {
    return this.marketplaceOfferService.create(listingId, userId, dto);
  }

  @Get()
  findAll() {
    return this.marketplaceOfferService.findAll();
  }

  @Get('/listing/:id')
  @ApiOperation({
    summary:
      'Get all offers (of the current seller) for a listing. Offset pagination.',
  })
  @ApiParam({
    name: 'id',
    description: 'The listing id',
    type: 'string',
  })
  findAllOffersByListingId(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.marketplaceOfferService.findAllOffersByListingId(
      userId,
      id,
      query,
    );
  }

  @Post(':id/accept')
  @ApiOperation({
    summary: 'Accept an offer. Seller only',
  })
  @ApiParam({
    name: 'id',
    description: 'The offer id',
    type: 'string',
  })
  acceptOffer(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.marketplaceOfferService.acceptOffer(userId, id);
  }

  @Post(':id/decline')
  @ApiOperation({
    summary: 'Decline an offer. Seller only',
  })
  @ApiParam({
    name: 'id',
    description: 'The offer id',
    type: 'string',
  })
  declineOffer(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.marketplaceOfferService.declineOffer(userId, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketplaceOfferService.remove(+id);
  }
}
