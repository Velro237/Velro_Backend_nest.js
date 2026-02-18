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
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthConstants } from 'src/shared/constants';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileConstants } from 'src/shared/constants/file.constants';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CacheTTL } from '@nestjs/cache-manager';
import { RedisCacheInterceptor } from 'src/redis/interceptors/redis-cache.interceptor';
import { RedisTTL } from 'src/redis/decorators/redis-ttl.decorator';
import {
  MarketplaceListingDetialDto,
  MarketplaceListingDto,
} from './dto/get-marketplace-listing.dto';

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
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', FileConstants.MAX_FILE_UPLOADS))
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The record has been successfully created.',
    type: MarketplaceListingDto,
  })
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successful response',
    type: MarketplaceListingDetialDto,
  })
  @RedisTTL(60000)
  @UseInterceptors(RedisCacheInterceptor)
  findOne(@Param('id') id: string) {
    return this.marketplaceListingService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMarketplaceListingDto: UpdateMarketplaceListingDto,
  ) {
    return this.marketplaceListingService.update(
      +id,
      updateMarketplaceListingDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/publish')
  publish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.marketplaceListingService.publish(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketplaceListingService.remove(+id);
  }
}
