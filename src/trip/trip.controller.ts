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
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TripService } from './trip.service';
import { CreateTripDto, CreateTripResponseDto } from './dto/create-trip.dto';
import { UpdateTripDto, UpdateTripResponseDto } from './dto/update-trip.dto';
import { TripItemListDto } from './dto/trip-item-list.dto';
import {
  CreateTransportTypeDto,
  CreateTransportTypeResponseDto,
} from './dto/create-transport-type.dto';
import {
  UpdateTransportTypeDto,
  UpdateTransportTypeResponseDto,
} from './dto/update-transport-type.dto';
import {
  CreateTripItemDto,
  CreateTripItemResponseDto,
} from './dto/create-trip-item.dto';
import {
  UpdateTripItemDto,
  UpdateTripItemResponseDto,
} from './dto/update-trip-item.dto';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiCreateTrip,
  ApiUpdateTrip,
  ApiCreateTransportType,
  ApiUpdateTransportType,
  ApiGetAllTransportTypes,
  ApiGetTransportTypeById,
  ApiCreateTripItem,
  ApiUpdateTripItem,
  ApiGetAllTripItems,
  ApiGetTripItemById,
} from './decorators/api-docs.decorator';
import {
  GetTripsQueryDto,
  GetTripsResponseDto,
  UserInfoDto,
  ModeOfTransportDto,
} from './dto/get-trips.dto';
import {
  GetTransportTypesQueryDto,
  GetTransportTypesResponseDto,
} from './dto/get-transport-types.dto';
import {
  GetTripItemsQueryDto,
  GetTripItemsResponseDto,
} from './dto/get-trip-items.dto';
import { GetTripByIdResponseDto } from './dto/get-trip-by-id.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';

@ApiTags('Trips')
@ApiExtraModels(
  TripItemListDto,
  GetTransportTypesQueryDto,
  GetTransportTypesResponseDto,
  GetTripItemsQueryDto,
  GetTripItemsResponseDto,
)
@Controller('trip')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiCreateTrip()
  async createTrip(
    @Body() createTripDto: CreateTripDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CreateTripResponseDto> {
    return this.tripService.createTrip(createTripDto, user.id, lang);
  }

  @Patch(':id')
  @ApiUpdateTrip()
  async updateTrip(
    @Param('id') tripId: string,
    @Body() updateTripDto: UpdateTripDto,
    @I18nLang() lang: string,
  ): Promise<UpdateTripResponseDto> {
    // For demo purposes, using a dummy user ID
    // In a real app, this would come from authentication
    const dummyUserId = '123e4567-e89b-12d3-a456-426614174000';
    return this.tripService.updateTrip(
      tripId,
      updateTripDto,
      dummyUserId,
      lang,
    );
  }

  // TransportType endpoints
  @Post('transport-types')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateTransportType()
  async createTransportType(
    @Body() createTransportTypeDto: CreateTransportTypeDto,
    @I18nLang() lang: string,
  ): Promise<CreateTransportTypeResponseDto> {
    return this.tripService.createTransportType(createTransportTypeDto, lang);
  }

  @Patch('transport-types/:id')
  @ApiUpdateTransportType()
  async updateTransportType(
    @Param('id') transportTypeId: string,
    @Body() updateTransportTypeDto: UpdateTransportTypeDto,
    @I18nLang() lang: string,
  ): Promise<UpdateTransportTypeResponseDto> {
    return this.tripService.updateTransportType(
      transportTypeId,
      updateTransportTypeDto,
      lang,
    );
  }

  // TripItem endpoints
  @Post('trip-items')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateTripItem()
  async createTripItem(
    @Body() createTripItemDto: CreateTripItemDto,
    @I18nLang() lang: string,
  ): Promise<CreateTripItemResponseDto> {
    return this.tripService.createTripItem(createTripItemDto, lang);
  }

  @Patch('trip-items/:id')
  @ApiUpdateTripItem()
  async updateTripItem(
    @Param('id') tripItemId: string,
    @Body() updateTripItemDto: UpdateTripItemDto,
    @I18nLang() lang: string,
  ): Promise<UpdateTripItemResponseDto> {
    return this.tripService.updateTripItem(tripItemId, updateTripItemDto, lang);
  }

  // GET endpoints for TransportType
  @Get('transport-types')
  @ApiGetAllTransportTypes()
  async getAllTransportTypes(
    @Query() query: GetTransportTypesQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetTransportTypesResponseDto> {
    return this.tripService.getAllTransportTypes(query, lang);
  }

  @Get('transport-types/:id')
  @ApiGetTransportTypeById()
  async getTransportTypeById(
    @Param('id') transportTypeId: string,
    @I18nLang() lang: string,
  ) {
    return this.tripService.getTransportTypeById(transportTypeId, lang);
  }

  // GET endpoints for TripItem
  @Get('trip-items')
  @ApiGetAllTripItems()
  async getAllTripItems(
    @Query() query: GetTripItemsQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetTripItemsResponseDto> {
    return this.tripService.getAllTripItems(query, lang);
  }

  @Get('trip-items/:id')
  @ApiGetTripItemById()
  async getTripItemById(
    @Param('id') tripItemId: string,
    @I18nLang() lang: string,
  ) {
    return this.tripService.getTripItemById(tripItemId, lang);
  }

  // Get trips with pagination and country filtering
  @Get('trips')
  @ApiOperation({
    summary: 'Get trips with pagination, search, and country prioritization',
    description:
      'Retrieve all published trips with optional search, country prioritization, and pagination. Search by departure_date, arrival_date, delivery/pickup/destination country name, code, or address. All searches are case-insensitive. When country is specified (without search), trips from that country are shown first, followed by all other trips. When search is used, country prioritization is disabled and results are returned in natural order. Perfect for mobile app infinite scroll.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trips retrieved successfully (message will be translated)',
    type: GetTripsResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
  })
  async getTrips(
    @Query() query: GetTripsQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetTripsResponseDto> {
    return this.tripService.getTrips(query, lang);
  }

  // Get trip by ID with full details
  @Get('trips/:id')
  @ApiOperation({
    summary: 'Get trip by ID with full details',
    description:
      'Retrieve complete trip information including all trip items and transport details.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip retrieved successfully (message will be translated)',
    type: GetTripByIdResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found (message will be translated)',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
  })
  async getTripById(
    @Param('id') tripId: string,
    @I18nLang() lang: string,
  ): Promise<GetTripByIdResponseDto> {
    return this.tripService.getTripById(tripId, lang);
  }
}
