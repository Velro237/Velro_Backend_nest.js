import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShippingOfferService } from './shipping-offer.service';
import { CreateShippingOfferDto } from './dto/create-shipping-offer.dto';

@ApiTags('Shipping Offers')
@Controller('shipping-offers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShippingOfferController {
  constructor(private readonly shippingOfferService: ShippingOfferService) {}

  @Post()
  @ApiOperation({ summary: 'Create a shipping offer' })
  async create(@Request() req, @Body() dto: CreateShippingOfferDto) {
    const userId = req.user.id;
    const lang = req.user.lang || 'en';
    return this.shippingOfferService.create(userId, dto, lang);
  }

  @Get('request/:requestId')
  @ApiOperation({
    summary: 'Get all offers for a shipping request (request owner only)',
  })
  async getOffersForRequest(
    @Request() req,
    @Param('requestId') requestId: string,
  ) {
    const userId = req.user.id;
    return this.shippingOfferService.getOffersForRequest(requestId, userId);
  }

  @Get('my-offers')
  @ApiOperation({ summary: 'Get all my offers (traveler)' })
  async getMyOffers(@Request() req) {
    const userId = req.user.id;
    return this.shippingOfferService.getMyOffers(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific offer by ID' })
  async getOfferById(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.getOfferById(id, userId);
  }

  @Patch(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an offer (request owner only)' })
  async acceptOffer(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.acceptOffer(id, userId);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an offer (request owner only)' })
  async rejectOffer(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.rejectOffer(id, userId);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an offer (traveler only)' })
  async cancelOffer(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.cancelOffer(id, userId);
  }

  @Get(':id/chat')
  @ApiOperation({ summary: 'Get chat for a shipping offer' })
  @ApiResponse({ status: 200, description: 'Chat returned successfully' })
  async getChat(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.getChatForOffer(id, userId);
  }
}
