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
import { ApiTags, ApiExtraModels, ApiBearerAuth } from '@nestjs/swagger';
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
      changeRequestStatusDto.chatId,
      changeRequestStatusDto.status,
      user.id,
      lang,
    );
  }
}
