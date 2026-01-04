import {
  Controller,
  Post,
  Put,
  Delete,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import {
  CreateDeliveryDto,
  CreateDeliveryResponseDto,
} from './dto/create-delivery.dto';
import {
  UpdateDeliveryDto,
  UpdateDeliveryResponseDto,
} from './dto/update-delivery.dto';
import {
  UpdateDeliveryProductDto,
  UpdateDeliveryProductResponseDto,
} from './dto/update-delivery-product.dto';
import {
  GetAllDeliveriesQueryDto,
  GetAllDeliveriesResponseDto,
} from './dto/get-all-deliveries.dto';
import { DeleteDeliveryResponseDto } from './dto/delete-delivery.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { I18nLang } from 'nestjs-i18n';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';

@ApiTags('Delivery')
@ApiBearerAuth('JWT-auth')
@Controller('delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new delivery',
    description:
      'Create a new delivery with delivery products. The user ID is automatically taken from the authenticated user (JWT token). Each product can have images (uploaded to Cloudinary) or imageUrl (stored directly). Total cost is calculated from the sum of all product prices. Reward must be at least 15. Expected date must be greater than today.',
  })
  @ApiBody({
    type: CreateDeliveryDto,
    description: 'Delivery creation data',
  })
  @ApiResponse({
    status: 201,
    description: 'Delivery created successfully',
    type: CreateDeliveryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or reward less than 15',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createDelivery(
    @Body() createDeliveryDto: CreateDeliveryDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CreateDeliveryResponseDto> {
    return this.deliveryService.createDelivery(createDeliveryDto, user.id, lang);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a delivery',
    description:
      'Update delivery information. Only provided fields will be updated. Expected date must be greater than today if provided. Reward must be at least 15 if provided.',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery updated successfully',
    type: UpdateDeliveryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async updateDelivery(
    @Param('id') deliveryId: string,
    @Body() updateDeliveryDto: UpdateDeliveryDto,
    @I18nLang() lang: string,
  ): Promise<UpdateDeliveryResponseDto> {
    return this.deliveryService.updateDelivery(
      deliveryId,
      updateDeliveryDto,
      lang,
    );
  }

  @Put('product/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a delivery product',
    description:
      'Update a delivery product. When price or quantity is updated, the delivery total cost will be automatically recalculated and updated. Images can be added (uploaded to Cloudinary) or imageUrl can be provided (stored directly).',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery product updated successfully',
    type: UpdateDeliveryProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery product not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async updateDeliveryProduct(
    @Param('productId') productId: string,
    @Body() updateDeliveryProductDto: UpdateDeliveryProductDto,
    @I18nLang() lang: string,
  ): Promise<UpdateDeliveryProductResponseDto> {
    return this.deliveryService.updateDeliveryProduct(
      productId,
      updateDeliveryProductDto,
      lang,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a delivery',
    description:
      'Soft delete a delivery by setting is_deleted to true. The delivery will not appear in listings but data is preserved.',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery deleted successfully',
    type: DeleteDeliveryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Delivery already deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async deleteDelivery(
    @Param('id') deliveryId: string,
    @I18nLang() lang: string,
  ): Promise<DeleteDeliveryResponseDto> {
    return this.deliveryService.deleteDelivery(deliveryId, lang);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all deliveries (paginated)',
    description:
      'Get a paginated list of all deliveries. Can filter by status and userId. Only returns non-deleted deliveries.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deliveries retrieved successfully',
    type: GetAllDeliveriesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getAllDeliveries(
    @Query() query: GetAllDeliveriesQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetAllDeliveriesResponseDto> {
    return this.deliveryService.getAllDeliveries(query, lang);
  }
}
