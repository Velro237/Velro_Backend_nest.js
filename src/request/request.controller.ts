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
} from '@nestjs/common';
import { ApiTags, ApiExtraModels } from '@nestjs/swagger';
import { RequestService } from './request.service';
import { I18nLang } from 'nestjs-i18n';
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
  ApiCreateTripRequest,
  ApiGetTripRequests,
  ApiUpdateTripRequest,
} from './decorators/api-docs.decorator';

@ApiTags('Trip Requests')
@ApiExtraModels(
  CreateTripRequestDto,
  CreateTripRequestResponseDto,
  CreateTripRequestImageDto,
  GetTripRequestsQueryDto,
  GetTripRequestsResponseDto,
  UpdateTripRequestDto,
  UpdateTripRequestResponseDto,
  TripItemImageDto,
  TripItemDetailsDto,
  TripRequestItemSummaryDto,
  TripRequestSummaryDto,
)
@Controller('request')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  // Trip Request endpoints
  @Post('trip')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateTripRequest()
  async createTripRequest(
    @Body() createTripRequestDto: CreateTripRequestDto,
    @I18nLang() lang: string,
  ): Promise<CreateTripRequestResponseDto> {
    return this.requestService.createTripRequest(createTripRequestDto, lang);
  }

  @Get('trip')
  @ApiGetTripRequests()
  async getTripRequests(
    @Query() query: GetTripRequestsQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetTripRequestsResponseDto> {
    return this.requestService.getTripRequests(query, lang);
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
}
