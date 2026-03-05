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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  getSchemaPath,
  ApiParam,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
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
  CreateManualShoppingRequestDto,
} from './dto/create-shopping-request.dto';
import { UpdateShoppingRequestDto } from './dto/update-shopping-request.dto';
import {
  GetShoppingRequestsQueryDto,
  GetUserShoppingRequestsQueryDto,
} from './dto/get-shopping-requests-query.dto';
import { GetShoppingRequestQueryDto } from './dto/get-shopping-request-query.dto';

@ApiTags('shopping-request')
@ApiExtraModels(CreateShoppingRequestDto, CreateManualShoppingRequestDto)
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
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'DRAFT' },
        userId: { type: 'string', example: 'user-uuid' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'DRAFT',
        userId: 'user-uuid',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Validation failed or invalid input',
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
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'DRAFT' },
        userId: { type: 'string', example: 'user-uuid' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'DRAFT',
        userId: 'user-uuid',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid URL or validation failed',
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
  async createFromUrl(
    @Body() dto: CreateShoppingRequestFromUrlDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ) {
    return this.shoppingRequestService.createFromUrl(user.id, dto, lang);
  }

  @Post('manual')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create shopping request manually with uploaded images',
    description:
      'Creates a shopping request with manually entered product details and user-uploaded images (max 6, 5MB each). No product URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(CreateManualShoppingRequestDto) },
        {
          type: 'object',
          properties: {
            images: {
              type: 'array',
              items: { type: 'string', format: 'binary' },
              maxItems: 6,
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Shopping request created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'DRAFT' },
        userId: { type: 'string', example: 'user-uuid' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'DRAFT',
        userId: 'user-uuid',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - At least one image is required or validation failed',
    schema: {
      example: {
        statusCode: 400,
        message: 'At least one image is required',
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
  @UseInterceptors(
    FilesInterceptor('images', 6, {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createManual(
    @Body() dto: CreateManualShoppingRequestDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ) {
    return this.shoppingRequestService.createManual(
      user.id,
      dto,
      files ?? [],
      lang,
    );
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
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number', example: 10 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
      example: {
        data: [],
        total: 10,
        page: 1,
        limit: 10,
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
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'PUBLISHED' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'PUBLISHED',
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
    description: 'Shopping request not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'SHOPPING_REQUEST_NOT_FOUND' },
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
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShoppingRequestDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ) {
    return this.shoppingRequestService.update(user.id, id, dto, lang);
  }

  @Get('/my')
  @ApiOperation({
    summary: 'Get my shopping requests',
    description: 'Returns all shopping requests for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Shopping requests retrieved successfully',
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
    description: 'Forbidden - Not authorized to view this request',
    schema: {
      example: { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Shopping request not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'SHOPPING_REQUEST_NOT_FOUND' },
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
  getUserShoppingRequests(
    @CurrentUser() user: User,
    @Query() query: GetUserShoppingRequestsQueryDto,
  ) {
    return this.shoppingRequestService.getUserShoppingRequests(user.id, query);
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
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'PUBLISHED' },
        offers: { type: 'array', items: { type: 'object' } },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'PUBLISHED',
        offers: [],
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
    description: 'Forbidden - Not authorized to view this request',
    schema: {
      example: { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Shopping request not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'SHOPPING_REQUEST_NOT_FOUND' },
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
              shoppingRequestId: { type: 'string' },
              travelerId: { type: 'string' },
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
    description: 'Forbidden - Only the request owner may view offers',
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
    description: 'Shopping request or offer not found',
    schema: {
      example: {
        statusCode: 404,
        message: { code: 'SHOPPING_REQUEST_NOT_FOUND' },
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
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.offersService.getOffersForRequest(id, user.id);
  }
}
