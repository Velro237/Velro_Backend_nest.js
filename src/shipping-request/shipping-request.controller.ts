import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Put,
  Delete,
  Query,
  Param,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ShippingRequestService } from './shipping-request.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import { CreateShippingRequestDto } from './dto/create-shipping-request.dto';
import { UpdateShippingRequestDto } from './dto/update-shipping-request.dto';
import { GetShippingRequestsQueryDto } from './dto/get-shipping-requests-query.dto';

@ApiTags('shipping-requests')
@ApiExtraModels(CreateShippingRequestDto)
@Controller('shipping-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ShippingRequestController {
  constructor(
    private readonly shippingRequestService: ShippingRequestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create shipping request' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(CreateShippingRequestDto) },
        {
          type: 'object',
          properties: {
            package_image: { type: 'string', format: 'binary' },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Shipping request created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'PUBLISHED' },
        userId: { type: 'string', example: 'user-uuid' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'PUBLISHED',
        userId: 'user-uuid',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Validation failed or file too large (max 5MB)',
    schema: {
      example: {
        statusCode: 400,
        message: 'File too large (max 5MB)',
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
  @UseInterceptors(FilesInterceptor('package_image', 1))
  async create(
    @Body() dto: CreateShippingRequestDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: User,
  ) {
    const file = files && files.length > 0 ? files[0] : undefined;
    return this.shippingRequestService.create(user.id, dto, file);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all shipping requests',
    description:
      'List all published shipping requests for discovery. Use query params to filter by status and paginate.',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipping requests retrieved',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number', example: 10 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
      example: { data: [], total: 10, page: 1, limit: 10 },
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
  async getAll(@Query() query: GetShippingRequestsQueryDto) {
    return this.shippingRequestService.getAll(query);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get shipping requests for current user' })
  @ApiResponse({
    status: 200,
    description: 'Shipping requests retrieved',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number', example: 10 },
      },
      example: { data: [], total: 10 },
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
  async getMine(
    @Query() query: GetShippingRequestsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.shippingRequestService.getMine(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a shipping request by id' })
  @ApiParam({ name: 'id', description: 'Shipping request ID' })
  @ApiResponse({
    status: 200,
    description: 'Shipping request retrieved',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', example: 'PUBLISHED' },
        userId: { type: 'string', example: 'user-uuid' },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'PUBLISHED',
        userId: 'user-uuid',
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
  async getOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.shippingRequestService.getById(id, user.id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a shipping request' })
  @ApiParam({ name: 'id', description: 'Shipping request ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(CreateShippingRequestDto) },
        {
          type: 'object',
          properties: {
            package_image: { type: 'string', format: 'binary' },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Shipping request updated successfully',
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
    description: 'Bad request - Validation failed or file too large',
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
  @UseInterceptors(FilesInterceptor('package_image', 1))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShippingRequestDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: User,
  ) {
    const file = files && files.length > 0 ? files[0] : undefined;
    return this.shippingRequestService.update(user.id, id, dto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel (soft-delete) a shipping request' })
  @ApiParam({ name: 'id', description: 'Shipping request ID' })
  @ApiResponse({
    status: 200,
    description: 'Shipping request cancelled',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Shipping request cancelled successfully',
        },
      },
      example: { message: 'Shipping request cancelled successfully' },
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
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.shippingRequestService.remove(user.id, id);
  }
}
