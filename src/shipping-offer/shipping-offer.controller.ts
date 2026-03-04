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
  @ApiResponse({
    status: 201,
    description: 'Shipping offer created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        shippingRequestId: { type: 'string', example: 'request-uuid' },
        travelerId: { type: 'string', example: 'user-uuid' },
        status: { type: 'string', example: 'PENDING' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        shippingRequestId: 'request-uuid',
        travelerId: 'user-uuid',
        status: 'PENDING',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Validation failed',
    schema: {
      example: {
        statusCode: 400,
        message: 'Validation failed',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Shipping request not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'SHIPPING_REQUEST_NOT_FOUND' },
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    },
  })
  async create(@Request() req, @Body() dto: CreateShippingOfferDto) {
    const userId = req.user.id;
    const lang = req.user.lang || 'en';
    return this.shippingOfferService.create(userId, dto, lang);
  }

  @Get('request/:requestId')
  @ApiOperation({
    summary: 'Get all offers for a shipping request (request owner only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Offers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        offers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              shippingRequestId: { type: 'string' },
              travelerId: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
      example: { offers: [] },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the request owner',
    schema: {
      example: {
        statusCode: 403,
        message: 'NOT_REQUEST_OWNER',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Shipping request not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'SHIPPING_REQUEST_NOT_FOUND' },
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    },
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
  @ApiResponse({
    status: 200,
    description: 'My offers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        offers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              shippingRequestId: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
      example: { offers: [] },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    },
  })
  async getMyOffers(@Request() req) {
    const userId = req.user.id;
    return this.shippingOfferService.getMyOffers(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific offer by ID' })
  @ApiResponse({
    status: 200,
    description: 'Offer retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        shippingRequestId: { type: 'string', example: 'request-uuid' },
        travelerId: { type: 'string', example: 'user-uuid' },
        status: { type: 'string', example: 'PENDING' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        shippingRequestId: 'request-uuid',
        travelerId: 'user-uuid',
        status: 'PENDING',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not authorized to view this offer',
    schema: {
      example: {
        statusCode: 403,
        message: 'NOT_AUTHORIZED_TO_VIEW_OFFER',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'OFFER_NOT_FOUND' },
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    },
  })
  async getOfferById(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.getOfferById(id, userId);
  }

  @Patch(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an offer (request owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Offer accepted successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'ACCEPTED' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'ACCEPTED',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Offer not in valid state for acceptance',
    schema: {
      example: {
        statusCode: 400,
        message: 'Offer cannot be accepted',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the request owner',
    schema: {
      example: {
        statusCode: 403,
        message: 'NOT_REQUEST_OWNER',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'OFFER_NOT_FOUND' },
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    },
  })
  async acceptOffer(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.acceptOffer(id, userId);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an offer (request owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Offer rejected successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'REJECTED' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'REJECTED',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the request owner',
    schema: {
      example: {
        statusCode: 403,
        message: 'NOT_REQUEST_OWNER',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'OFFER_NOT_FOUND' },
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    },
  })
  async rejectOffer(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.rejectOffer(id, userId);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an offer (traveler only)' })
  @ApiResponse({
    status: 200,
    description: 'Offer cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'CANCELLED' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'CANCELLED',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Offer not in valid state for cancellation',
    schema: {
      example: {
        statusCode: 400,
        message: 'Offer cannot be cancelled',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not the offer owner (traveler)',
    schema: {
      example: {
        statusCode: 403,
        message: 'NOT_OFFER_OWNER',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'OFFER_NOT_FOUND' },
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    },
  })
  async cancelOffer(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.cancelOffer(id, userId);
  }

  @Get(':id/chat')
  @ApiOperation({ summary: 'Get chat for a shipping offer' })
  @ApiResponse({
    status: 200,
    description: 'Chat returned successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'chat-uuid' },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              senderId: { type: 'string' },
            },
          },
        },
      },
      example: { id: 'chat-uuid', messages: [] },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not a member of this offer',
    schema: {
      example: {
        statusCode: 403,
        message: 'NOT_OFFER_MEMBER',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Offer or chat not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'OFFER_NOT_FOUND' },
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    },
  })
  async getChat(@Request() req, @Param('id') id: string) {
    const userId = req.user.id;
    return this.shippingOfferService.getChatForOffer(id, userId);
  }
}
