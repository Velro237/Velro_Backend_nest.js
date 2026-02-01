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
  constructor(private readonly shippingRequestService: ShippingRequestService) {}

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
  @ApiResponse({ status: 201, description: 'Shipping request created' })
  @UseInterceptors(FilesInterceptor('package_image', 1))
  async create(
    @Body() dto: CreateShippingRequestDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: User,
  ) {
    const file = files && files.length > 0 ? files[0] : undefined;
    return this.shippingRequestService.create(user.id, dto, file);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get shipping requests for current user' })
  @ApiResponse({ status: 200, description: 'Shipping requests retrieved' })
  async getMine(
    @Query() query: GetShippingRequestsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.shippingRequestService.getMine(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a shipping request by id' })
  @ApiParam({ name: 'id', description: 'Shipping request ID' })
  @ApiResponse({ status: 200, description: 'Shipping request retrieved' })
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
  @ApiResponse({ status: 200, description: 'Shipping request cancelled' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.shippingRequestService.remove(user.id, id);
  }
}
