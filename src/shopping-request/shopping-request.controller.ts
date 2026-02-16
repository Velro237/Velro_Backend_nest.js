import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  getSchemaPath,
  ApiParam,
} from '@nestjs/swagger';
import { RequestSource } from 'generated/prisma';
import { I18nLang } from 'nestjs-i18n';
import { ShoppingRequestService } from './shopping-request.service';
import { OffersService } from '../offers/offers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import {
  CreateShoppingRequestDto,
  CreateShoppingRequestFromUrlDto,
} from './dto/create-shopping-request.dto';
import { UpdateShoppingRequestDto } from './dto/update-shopping-request.dto';
import { GetShoppingRequestsQueryDto } from './dto/get-shopping-requests-query.dto';
import { GetShoppingRequestQueryDto } from './dto/get-shopping-request-query.dto';

@ApiTags('shopping-request')
@ApiExtraModels(CreateShoppingRequestDto)
@Controller('shopping-request')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ShoppingRequestController {
  constructor(
    private readonly shoppingRequestService: ShoppingRequestService,
    private readonly offersService: OffersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create shopping request (manual or webview)',
    description:
      'Creates a new shopping request. Can be used for manual entry or webview basket import.',
  })
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(CreateShoppingRequestDto) },
        {
          type: 'object',
          properties: {
            source: {
              oneOf: [
                { type: 'string', enum: Object.values(RequestSource) },
                { type: 'string', format: 'url' },
              ],
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Shopping request created successfully',
  })
  async create(
    @Body() dto: CreateShoppingRequestDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ) {
    return this.shoppingRequestService.create(user.id, dto, lang);
  }

  @Post('from-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create shopping request from product URL',
    description:
      'Creates a shopping request by scraping product details from a URL. Supports Amazon, Shein, H&M, Nike, Zara, Apple, and eBay.',
  })
  @ApiBody({ type: CreateShoppingRequestFromUrlDto })
  @ApiResponse({
    status: 201,
    description: 'Shopping request created successfully from URL',
  })
  async createFromUrl(
    @Body() dto: CreateShoppingRequestFromUrlDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ) {
    return this.shoppingRequestService.createFromUrl(user.id, dto, lang);
  }

  @Get()
  @ApiOperation({
    summary: 'Get shopping requests with pagination',
    description:
      'Returns paginated shopping requests. Can filter by status and type (my_requests or available).',
  })
  @ApiResponse({
    status: 200,
    description: 'Shopping requests retrieved successfully',
  })
  async getRequests(
    @Query() query: GetShoppingRequestsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.shoppingRequestService.getRequests(user.id, query);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update shopping request',
    description:
      'Updates a shopping request. If offers exist, creates a new version while keeping old offers linked to the previous version.',
  })
  @ApiParam({
    name: 'id',
    description: 'Shopping Request ID',
  })
  @ApiBody({ type: UpdateShoppingRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Shopping request updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShoppingRequestDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ) {
    return this.shoppingRequestService.update(user.id, id, dto, lang);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a shopping request by id',
    description:
      'Returns a shopping request. If the caller is the request owner, returned data includes submitted offers.',
  })
  @ApiParam({ name: 'id', description: 'Shopping Request ID' })
  @ApiResponse({
    status: 200,
    description: 'Shopping request retrieved successfully',
  })
  async getById(
    @Param('id') id: string,
    @Query() query: GetShoppingRequestQueryDto,
    @CurrentUser() user: User,
  ) {
    const page = query?.offersPage ?? 1;
    const limit = query?.offersLimit ?? 3;
    return this.shoppingRequestService.getRequestById(user.id, id, {
      page,
      limit,
    });
  }

  @Get(':id/offers')
  @ApiOperation({
    summary: 'Get offers for a shopping request',
    description:
      'Returns all offers made for a specific shopping request. Only the request owner may view offers.',
  })
  @ApiParam({ name: 'id', description: 'Shopping Request ID' })
  @ApiResponse({ status: 200, description: 'Offers retrieved successfully' })
  async getOffersForRequest(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.offersService.getOffersForRequest(id, user.id);
  }
}
