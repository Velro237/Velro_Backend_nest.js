import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { MarketplaceListingService } from './marketplace-listing.service';
import { CreateMarketplaceListingDto } from './dto/create-marketplace-listing.dto';
import { UpdateMarketplaceListingDto } from './dto/update-marketplace-listing.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthConstants } from 'src/shared/constants';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileConstants } from 'src/shared/constants/file.constants';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RedisCacheInterceptor } from 'src/redis/interceptors/redis-cache.interceptor';
import { RedisTTL } from 'src/redis/decorators/redis-ttl.decorator';
import {
  MarketplaceListingDetialDto,
  MarketplaceListingDto,
} from './dto/get-marketplace-listing.dto';
import { TimeSec } from 'src/shared/utils';

@ApiTags('Marketplace', 'Listing')
@ApiExtraModels(CreateMarketplaceListingDto)
@Controller({
  path: 'marketplace/listing',
  version: '1',
})
@ApiBearerAuth(AuthConstants.SWAGGER_BEARER_TOKEN_KEY)
export class MarketplaceListingController {
  constructor(
    private readonly marketplaceListingService: MarketplaceListingService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new marketplace listing',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(CreateMarketplaceListingDto) },
        {
          type: 'object',
          properties: {
            images: { type: 'string', format: 'binary' },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The record has been successfully created.',
    type: MarketplaceListingDto,
  })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', FileConstants.MAX_FILE_UPLOADS))
  create(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: FileConstants.MAX_FILE_SIZE,
        })
        .addFileTypeValidator({
          fileType: /\/(jpg|jpeg|png|webp)$/i,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    images: Express.Multer.File[],
    @Body() createMarketplaceListingDto: CreateMarketplaceListingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.marketplaceListingService.create(
      images,
      createMarketplaceListingDto,
      userId,
    );
  }

  @Get()
  findAll() {
    return this.marketplaceListingService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific marketplace listing and its details',
  })
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successful response',
    type: MarketplaceListingDetialDto,
  })
  @RedisTTL(TimeSec.minutes(1))
  @UseInterceptors(RedisCacheInterceptor)
  findOne(@Param('id') id: string) {
    return this.marketplaceListingService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a specific marketplace listing',
  })
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The record has been successfully updated.',
    type: MarketplaceListingDto,
  })
  update(
    @Param('id') id: string,
    @Body() updateMarketplaceListingDto: UpdateMarketplaceListingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.marketplaceListingService.update(
      id,
      updateMarketplaceListingDto,
      userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/publish')
  @ApiOperation({
    summary: 'Publish a specific marketplace listing',
  })
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The record has been successfully published.',
    type: MarketplaceListingDto,
  })
  publish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.marketplaceListingService.publish(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/mark-sold')
  @ApiOperation({
    summary: 'Publish a specific marketplace listing',
  })
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The record has been successfully published.',
    type: MarketplaceListingDto,
  })
  markSold(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.marketplaceListingService.markSold(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketplaceListingService.remove(+id);
  }
}
