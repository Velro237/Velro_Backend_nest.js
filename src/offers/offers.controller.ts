import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import { CreateOfferDto, CancelOfferDto } from './dto/create-offer.dto';
import { CreateFeedbackDto } from '../shopping-request/dto/create-feedback.dto';

@ApiTags('Shopping-offers')
@Controller('shopping-offers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an offer for a shopping request' })
  @ApiBody({ type: CreateOfferDto })
  @ApiResponse({
    status: 201,
    description: 'Offer created successfully',
    schema: {
      example: {
        id: 'offer_uuid',
        shoppingRequestId: 'req_abc123',
        travelerId: 'user_uuid',
        requestVersion: 1,
        rewardAmount: 189,
        rewardCurrency: 'EUR',
        additionalFees: 25,
        message:
          "I can deliver on Jan 10. I'll buy from the official store in Berlin.",
        travelDate: '2026-01-10T00:00:00.000Z',
        status: 'PENDING',
        createdAt: '2026-01-01T12:00:00.000Z',
      },
    },
  })
  async create(
    @Body() dto: CreateOfferDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ) {
    return this.offersService.create(user.id, dto, lang);
  }

  @Get('mine')
  @ApiOperation({ summary: "Get current user's offers" })
  @ApiResponse({
    status: 200,
    description: 'List of offers created by the authenticated traveler',
  })
  async getMine(@CurrentUser() user: User) {
    return this.offersService.getMyOffers(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all offers (admin)' })
  @ApiResponse({
    status: 200,
    description: 'All offers retrieved successfully',
  })
  async getAll() {
    return this.offersService.getAllOffers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an offer by id' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer retrieved successfully',
    schema: {
      example: {
        id: 'offer_uuid',
        shoppingRequestId: 'req_abc123',
        travelerId: 'user_uuid',
        traveler: {
          id: 'user_uuid',
          username: 'traveler1',
          profile_picture_url: null,
        },
        requestVersion: 1,
        rewardAmount: 189,
        rewardCurrency: 'EUR',
        additionalFees: 25,
        message:
          "I can deliver on Jan 10. I'll buy from the official store in Berlin.",
        travelDate: '2026-01-10T00:00:00.000Z',
        status: 'PENDING',
        createdAt: '2026-01-01T12:00:00.000Z',
      },
    },
  })
  async getOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.offersService.getOfferById(id, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an offer (cancel by traveler)' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: 200, description: 'Offer updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: CancelOfferDto,
    @CurrentUser() user: User,
  ) {
    return this.offersService.cancelOffer(id, user.id, dto);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept an offer (request owner)' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: 200, description: 'Offer accepted successfully' })
  async accept(@Param('id') id: string, @CurrentUser() user: User) {
    return this.offersService.acceptOffer(id, user.id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an offer (request owner)' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: 200, description: 'Offer rejected successfully' })
  async reject(@Param('id') id: string, @CurrentUser() user: User) {
    return this.offersService.rejectOffer(id, user.id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an accepted offer (request owner)' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiResponse({ status: 200, description: 'Offer cancelled successfully' })
  async cancelByOwner(
    @Param('id') id: string,
    @Body() dto: CancelOfferDto,
    @CurrentUser() user: User,
  ) {
    return this.offersService.cancelByOwner(id, user.id, dto);
  }

  @Post(':id/withdraw')
  @ApiOperation({
    summary: 'Withdraw an offer (traveler) — remove a pending offer',
  })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiBody({ type: CancelOfferDto })
  @ApiResponse({ status: 200, description: 'Offer withdrawn successfully' })
  async withdraw(
    @Param('id') id: string,
    @Body() dto: CancelOfferDto,
    @CurrentUser() user: User,
  ) {
    return this.offersService.withdrawOffer(id, user.id, dto);
  }

  @Post(':id/deliver')
  @ApiOperation({ summary: 'Mark offer as delivered (traveler)' })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiBody({ type: CancelOfferDto })
  @ApiResponse({ status: 200, description: 'Offer marked as delivered' })
  async deliver(
    @Param('id') id: string,
    @Body() dto: CancelOfferDto,
    @CurrentUser() user: User,
  ) {
    return this.offersService.deliverOffer(id, user.id, dto);
  }

  @Post(':id/confirm-delivery')
  @ApiOperation({
    summary:
      'Confirm delivery (request owner) — mark the shopping request as delivered',
  })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  @ApiBody({ type: CancelOfferDto })
  @ApiResponse({ status: 200, description: 'Delivery confirmed successfully' })
  async confirmDelivery(
    @Param('id') id: string,
    @Body() dto: CancelOfferDto,
    @CurrentUser() user: User,
  ) {
    return this.offersService.confirmDelivery(id, user.id, dto);
  }

  @Get(':id/chat')
  @ApiOperation({ summary: 'Get chat for an offer' })
  @ApiResponse({ status: 200, description: 'Chat returned successfully' })
  async getChat(@Param('id') id: string, @CurrentUser() user: User) {
    return this.offersService.getChatForOffer(id, user.id);
  }

  @Post(':id/review')
  @ApiOperation({
    summary: 'Leave a review/rating for an offer (request owner)',
  })
  @ApiParam({ name: 'id', description: 'Offer ID' })
  async reviewOffer(
    @Param('id') id: string,
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ) {
    return this.offersService.rateTravelerByOfferId(user.id, id, dto, lang);
  }
}
