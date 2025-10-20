import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiExtraModels,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { RequestService } from './request.service';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import {
  CreateTripRequestDto,
  CreateTripRequestResponseDto,
  CreateTripRequestImageDto,
} from './dto/create-trip-request.dto';
import { TripItemImageDto, TripItemDetailsDto } from '../shared/dto/common.dto';
import {
  GetTripRequestsQueryDto,
  GetTripRequestsResponseDto,
  TripRequestItemSummaryDto,
  TripRequestSummaryDto,
} from './dto/get-trip-requests.dto';
import {
  UpdateTripRequestDto,
  UpdateTripRequestResponseDto,
} from './dto/update-trip-request.dto';
import {
  ChangeRequestStatusDto,
  ChangeRequestStatusResponseDto,
} from './dto/change-request-status.dto';
import { GetRequestByIdResponseDto } from './dto/get-request-by-id.dto';
import { ConfirmDeliveryResponseDto } from './dto/confirm-delivery.dto';
import {
  CancelRequestDto,
  CancelRequestResponseDto,
} from './dto/cancel-request.dto';
import {
  GetUserRequestsQueryDto,
  GetUserRequestsResponseDto,
} from './dto/get-user-requests.dto';
import {
  ApiCreateTripRequest,
  ApiGetTripRequests,
  ApiUpdateTripRequest,
  ApiChangeRequestStatus,
} from './decorators/api-docs.decorator';

@ApiTags('Trip Requests')
@ApiExtraModels(
  CreateTripRequestDto,
  CreateTripRequestResponseDto,
  CreateTripRequestImageDto,
  GetTripRequestsQueryDto,
  GetTripRequestsResponseDto,
  GetRequestByIdResponseDto,
  UpdateTripRequestDto,
  UpdateTripRequestResponseDto,
  TripItemImageDto,
  TripItemDetailsDto,
  TripRequestItemSummaryDto,
  TripRequestSummaryDto,
)
@ApiTags('Request')
@ApiBearerAuth('JWT-auth')
@Controller('request')
@UseGuards(JwtAuthGuard)
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  // Trip Request endpoints
  @Post('trip')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateTripRequest()
  async createTripRequest(
    @Body() createTripRequestDto: CreateTripRequestDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CreateTripRequestResponseDto> {
    return this.requestService.createTripRequest(
      createTripRequestDto,
      user.id,
      lang,
    );
  }

  @Get('trip')
  @ApiGetTripRequests()
  async getTripRequests(
    @Query() query: GetTripRequestsQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetTripRequestsResponseDto> {
    return this.requestService.getTripRequests(query, lang);
  }

  @Get('trip/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get trip request by ID with full details',
    description:
      'Retrieve complete trip request information including full trip details (all locations, dates, times, trip items), requester information, requested items with prices, and request images.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip request ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @ApiResponse({
    status: 200,
    description: 'Request retrieved successfully (message will be translated)',
    type: GetRequestByIdResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Request not found (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Request not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to retrieve request' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getRequestById(
    @Param('id') requestId: string,
    @I18nLang() lang: string,
  ): Promise<GetRequestByIdResponseDto> {
    return this.requestService.getRequestById(requestId, lang);
  }

  @Patch('trip/:id')
  @ApiUpdateTripRequest()
  async updateTripRequest(
    @Param('id') requestId: string,
    @Body() updateTripRequestDto: UpdateTripRequestDto,
    @I18nLang() lang: string,
  ): Promise<UpdateTripRequestResponseDto> {
    return this.requestService.updateTripRequest(
      requestId,
      updateTripRequestDto,
      lang,
    );
  }

  @Patch('status')
  @HttpCode(HttpStatus.OK)
  @ApiChangeRequestStatus()
  async changeRequestStatus(
    @Body() changeRequestStatusDto: ChangeRequestStatusDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<ChangeRequestStatusResponseDto> {
    return this.requestService.changeRequestStatus(
      changeRequestStatusDto.requestId,
      changeRequestStatusDto.status,
      user.id,
      lang,
    );
  }

  @Post('orders/:id/confirm-delivery')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm delivery of order',
    description: 'Called by sender or traveler to confirm item delivery',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery confirmed',
    type: ConfirmDeliveryResponseDto,
  })
  async confirmDelivery(
    @Param('id') orderId: string,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<ConfirmDeliveryResponseDto> {
    return this.requestService.confirmDelivery(orderId, user.id, lang);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel trip request',
    description:
      'Cancel a trip request with proper fee distribution according to Velro policy',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Request cancelled successfully',
    type: CancelRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid cancellation request',
  })
  @ApiResponse({
    status: 404,
    description: 'Trip request not found',
  })
  async cancelRequest(
    @Param('id') requestId: string,
    @Body() cancelRequestDto: CancelRequestDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CancelRequestResponseDto> {
    return this.requestService.cancelRequest(
      requestId,
      cancelRequestDto,
      user.id,
      lang,
    );
  }

  @Get('user-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user requests with direction filter',
    description:
      "Retrieve requests based on direction: INCOMING (requests on trips the user created) or OUTGOING (requests the user made to others' trips). Optional status filter and pagination are supported.",
  })
  @ApiResponse({
    status: 200,
    description: 'Requests retrieved successfully',
    type: GetUserRequestsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getUserRequests(
    @Query() query: GetUserRequestsQueryDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetUserRequestsResponseDto> {
    return this.requestService.getUserRequests(user.id, query, lang);
  }
}
