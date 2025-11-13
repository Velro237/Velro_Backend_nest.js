import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiExtraModels,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { TripService } from './trip.service';
import { CreateTripDto, CreateTripResponseDto } from './dto/create-trip.dto';
import { UpdateTripDto, UpdateTripResponseDto } from './dto/update-trip.dto';
import { CancelTripDto, CancelTripResponseDto } from './dto/cancel-trip.dto';
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
  TranslationDto,
} from './dto/create-trip-item.dto';
import {
  UpdateTripItemDto,
  UpdateTripItemResponseDto,
} from './dto/update-trip-item.dto';
import {
  AddTripItemTranslationDto,
  AddTripItemTranslationResponseDto,
} from './dto/add-trip-item-translation.dto';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FileInterceptor } from '@nestjs/platform-express';
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
  TripItemListItemDto,
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
import {
  CreateAirlineDto,
  CreateAirlineResponseDto,
} from './dto/create-airline.dto';
import {
  GetAirlinesQueryDto,
  GetAirlinesResponseDto,
} from './dto/get-airlines.dto';
import { CreateAlertDto, CreateAlertResponseDto } from './dto/create-alert.dto';
import { UpdateAlertDto, UpdateAlertResponseDto } from './dto/update-alert.dto';
import { DeleteAlertResponseDto } from './dto/delete-alert.dto';
import { GetAlertsQueryDto, GetAlertsResponseDto } from './dto/get-alerts.dto';
import {
  GetUserTripsQueryDto,
  GetUserTripsResponseDto,
} from './dto/get-user-trips.dto';
import { GetUserTripDetailResponseDto } from './dto/get-user-trip-detail.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import { TripItemImageDto, TripItemDetailsDto } from '../shared/dto/common.dto';

@ApiTags('Trips')
@ApiBearerAuth('JWT-auth')
@ApiExtraModels(
  TripItemListDto,
  GetTransportTypesQueryDto,
  GetTransportTypesResponseDto,
  GetTripItemsQueryDto,
  GetTripItemsResponseDto,
  CreateAirlineDto,
  CreateAirlineResponseDto,
  GetAirlinesQueryDto,
  GetAirlinesResponseDto,
  CreateAlertDto,
  CreateAlertResponseDto,
  UpdateAlertDto,
  UpdateAlertResponseDto,
  DeleteAlertResponseDto,
  GetAlertsQueryDto,
  GetAlertsResponseDto,
  GetUserTripsQueryDto,
  GetUserTripsResponseDto,
  GetUserTripDetailResponseDto,
  TripItemImageDto,
  TripItemDetailsDto,
  TripItemListItemDto,
  TranslationDto,
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
  @UseGuards(JwtAuthGuard)
  async updateTrip(
    @Param('id') tripId: string,
    @Body() updateTripDto: UpdateTripDto,
    @I18nLang() lang: string,
    @CurrentUser() user: User,
  ): Promise<UpdateTripResponseDto> {
    // For demo purposes, using a dummy user ID
    // In a real app, this would come from authentication
    return this.tripService.updateTrip(tripId, updateTripDto, user.id, lang);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cancel a trip',
    description:
      'Cancel a trip as the traveler. This will automatically cancel related requests, process refunds for paid requests, send notifications, and archive chats. Cannot cancel if there are requests in transit.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip ID to cancel',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: CancelTripDto })
  @ApiResponse({
    status: 200,
    description: 'Trip cancelled successfully',
    type: CancelTripResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Trip already cancelled or has requests in transit',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not authorized to cancel this trip',
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found',
  })
  @ApiBearerAuth('JWT-auth')
  async cancelTrip(
    @Param('id') tripId: string,
    @Body() cancelTripDto: CancelTripDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CancelTripResponseDto> {
    return this.tripService.cancelTrip(
      tripId,
      user.id,
      cancelTripDto.reason,
      cancelTripDto.additionalNotes,
      lang,
    );
  }

  // TransportType endpoints
  @Post('transport-types')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiCreateTransportType()
  async createTransportType(
    @Body() createTransportTypeDto: CreateTransportTypeDto,
    @I18nLang() lang: string,
  ): Promise<CreateTransportTypeResponseDto> {
    return this.tripService.createTransportType(createTransportTypeDto, lang);
  }

  @Patch('transport-types/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
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
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiCreateTripItem()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async createTripItem(
    @Body() createTripItemDto: CreateTripItemDto,
    @I18nLang() lang: string,
    @UploadedFile()
    image?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    },
  ): Promise<CreateTripItemResponseDto> {
    if ('image' in createTripItemDto) {
      delete (createTripItemDto as any).image;
    }

    return this.tripService.createTripItem(createTripItemDto, lang, image);
  }

  @Patch('trip-items/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiUpdateTripItem()
  async updateTripItem(
    @Param('id') tripItemId: string,
    @Body() updateTripItemDto: UpdateTripItemDto,
    @I18nLang() lang: string,
  ): Promise<UpdateTripItemResponseDto> {
    return this.tripService.updateTripItem(tripItemId, updateTripItemDto, lang);
  }

  @Post('trip-items/:id/translations')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({
    summary: 'Add or update translation for a trip item',
    description:
      'Adds a new translation or updates an existing translation for a trip item. If a translation for the specified language already exists, it will be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: AddTripItemTranslationDto,
    description: 'Translation data',
    examples: {
      french: {
        summary: 'Add French translation',
        value: {
          translation: {
            language: 'fr',
            name: 'Électronique',
            description: 'Appareils et gadgets électroniques',
          },
        },
      },
      english: {
        summary: 'Add English translation',
        value: {
          translation: {
            language: 'en',
            name: 'Electronics',
            description: 'Electronic devices and gadgets',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Translation added/updated successfully',
    type: AddTripItemTranslationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Trip item not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async addTripItemTranslation(
    @Param('id') tripItemId: string,
    @Body() addTranslationDto: AddTripItemTranslationDto,
    @I18nLang() lang: string,
  ): Promise<AddTripItemTranslationResponseDto> {
    return this.tripService.addTripItemTranslation(
      tripItemId,
      addTranslationDto.translation,
      lang,
    );
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
    summary:
      'Get trips with pagination, filtering, search, and country prioritization',
    description:
      'Retrieve all published trips with optional filter (today/tomorrow/week/all), search, country prioritization, date range filtering, and pagination. Each trip includes from (departure) and to (destination) locations, trip items with pricing and availability, transport details, and chat_info (if user is a member of a chat for this trip). Filter options: "today" (trips departing today), "tomorrow" (trips departing tomorrow), "week" (trips departing this week), "all" (all future trips, default). Search by departure (city/country) or destination (city/country). All searches are case-insensitive. Date range: specify departure_date_from and departure_date_to to filter trips by departure date range. When country is specified (without search), trips with matching destination country are shown first, followed by all other trips. When search is used, country prioritization is disabled and results are returned in natural order. Perfect for mobile app infinite scroll.',
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
    @CurrentUser() user: User | null,
    @I18nLang() lang: string,
  ): Promise<GetTripsResponseDto> {
    return this.tripService.getTrips(query, user?.id, lang);
  }

  // Get trip by ID with full details
  @Get('trips/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get trip by ID with full details',
    description:
      'Retrieve complete trip information including all trip items and transport details. Requires authentication.',
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
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
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
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetTripByIdResponseDto> {
    return this.tripService.getTripById(tripId, user.id, lang);
  }

  // Get user's trips
  @Get('user-trips')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all trips created by the authenticated user',
    description:
      'Retrieve all trips created by the authenticated user with optional status filtering and pagination. Use status="ALL" to get trips with all statuses, or specify a specific TripStatus to filter. Returns departure, destination, status, dates, airline info, ratings with average rating calculation, and total payments from transactions with ONHOLD, COMPLETED, or SUCCESS status.',
  })
  @ApiResponse({
    status: 200,
    description:
      'User trips retrieved successfully (message will be translated)',
    type: GetUserTripsResponseDto,
    examples: {
      success: {
        summary: 'User trips retrieved successfully',
        value: {
          message: 'User trips retrieved successfully',
          trips: [
            {
              id: '123e4567-e89b-12d3-a456-426614174000',
              departure: {
                country: 'France',
                city: 'Paris',
                address: 'Charles de Gaulle Airport',
              },
              destination: {
                country: 'USA',
                city: 'New York',
                address: 'JFK Airport',
              },
              status: 'PUBLISHED',
              departure_date: '2024-02-15T10:00:00.000Z',
              departure_time: '10:00 AM',
              arrival_date: '2024-02-16T14:00:00.000Z',
              arrival_time: '02:00 PM',
              airline: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Air France',
                description: 'French international airline',
              },
              ratings: [
                {
                  id: '123e4567-e89b-12d3-a456-426614174001',
                  rating: 5,
                  comment: 'Great service and delivery!',
                  giver_id: '123e4567-e89b-12d3-a456-426614174002',
                },
                {
                  id: '123e4567-e89b-12d3-a456-426614174003',
                  rating: 4,
                  comment: 'Good experience',
                  giver_id: '123e4567-e89b-12d3-a456-426614174004',
                },
              ],
              average_rating: 4.5,
              total_payment: 250.0,
              createdAt: '2024-01-15T10:00:00.000Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 25,
            totalPages: 3,
            hasNext: true,
            hasPrev: false,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to retrieve user trips' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getUserTrips(
    @Query() query: GetUserTripsQueryDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetUserTripsResponseDto> {
    return this.tripService.getUserTrips(user.id, query, lang);
  }

  // Get user trip detail by ID
  @Get('user-trips/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Get detailed information about a specific trip created by the user',
    description:
      'Retrieve complete trip details including trip items with all data, all trip requests (with requesting user info, items requested with full details, status, and cost), fully_booked status, available_earnings (sum of SUCCESS and COMPLETED transactions), and hold_earnings (sum of ONHOLD transactions). Only the trip owner can access this endpoint.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description:
      'Trip details retrieved successfully (message will be translated)',
    type: GetUserTripDetailResponseDto,
    examples: {
      success: {
        summary: 'Trip details retrieved successfully',
        value: {
          message: 'Trip details retrieved successfully',
          trip: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            user_id: '123e4567-e89b-12d3-a456-426614174000',
            pickup: {
              country: 'France',
              city: 'Paris',
              address: 'Charles de Gaulle Airport',
            },
            departure: {
              country: 'France',
              city: 'Paris',
            },
            destination: {
              country: 'USA',
              city: 'New York',
            },
            delivery: {
              country: 'USA',
              city: 'New York',
              address: 'JFK Airport',
            },
            departure_date: '2024-02-15T10:00:00.000Z',
            departure_time: '10:00 AM',
            arrival_date: '2024-02-16T14:00:00.000Z',
            arrival_time: '02:00 PM',
            currency: 'USD',
            maximum_weight_in_kg: 20.0,
            notes: 'Please contact before delivery',
            meetup_flexible: true,
            status: 'PUBLISHED',
            fully_booked: false,
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z',
            airline: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Air France',
              description: 'French international airline',
            },
            mode_of_transport: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Airplane',
              description: 'Air travel',
            },
            trip_items: [
              {
                trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
                price: 50.0,
                available_kg: 5.0,
                trip_item: {
                  id: '123e4567-e89b-12d3-a456-426614174000',
                  name: 'Documents',
                  description: 'Letters and documents',
                  image: {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                    url: 'https://example.com/image.jpg',
                    alt_text: 'Documents icon',
                  },
                },
              },
            ],
            requests: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                user_id: '123e4567-e89b-12d3-a456-426614174001',
                status: 'APPROVED',
                cost: 150.0,
                message: 'Please handle with care',
                created_at: '2024-01-20T10:00:00.000Z',
                updated_at: '2024-01-20T10:00:00.000Z',
                user: {
                  id: '123e4567-e89b-12d3-a456-426614174001',
                  name: 'John Doe',
                  email: 'john@example.com',
                  picture: 'https://example.com/avatar.jpg',
                },
                request_items: [
                  {
                    trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
                    quantity: 2,
                    special_notes: 'Handle with care',
                    trip_item: {
                      id: '123e4567-e89b-12d3-a456-426614174000',
                      name: 'Documents',
                      description: 'Letters and documents',
                      image: {
                        id: '123e4567-e89b-12d3-a456-426614174000',
                        url: 'https://example.com/image.jpg',
                        alt_text: 'Documents icon',
                      },
                    },
                  },
                ],
              },
            ],
            available_earnings: 300.0,
            hold_earnings: 100.0,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Trip does not belong to the user',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'You are not authorized to view this trip',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Trip not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to retrieve trip details' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getUserTripDetail(
    @Param('id') tripId: string,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetUserTripDetailResponseDto> {
    return this.tripService.getUserTripDetail(user.id, tripId, lang);
  }

  // Airline endpoints
  @Post('airlines')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({
    summary: 'Create a new airline (Admin Only)',
    description:
      'Create a new airline with name and optional description. Requires admin privileges.',
  })
  @ApiBody({
    type: CreateAirlineDto,
    description: 'Airline creation data',
    examples: {
      americanAirlines: {
        summary: 'American Airlines',
        value: {
          name: 'American Airlines',
          description:
            'Major US airline serving domestic and international routes',
        },
      },
      deltaAirlines: {
        summary: 'Delta Air Lines',
        value: {
          name: 'Delta Air Lines',
          description: 'American airline serving global destinations',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Airline created successfully (message will be translated)',
    type: CreateAirlineResponseDto,
    examples: {
      success: {
        summary: 'Airline created successfully',
        value: {
          message: 'Airline created successfully',
          airline: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'American Airlines',
            description:
              'Major US airline serving domestic and international routes',
            created_at: '2024-01-15T10:30:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'Access denied. Admin privileges required.',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Airline name already exists (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: 'Airline with this name already exists',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'Failed to create airline',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async createAirline(
    @Body() createAirlineDto: CreateAirlineDto,
    @I18nLang() lang: string,
  ): Promise<CreateAirlineResponseDto> {
    return this.tripService.createAirline(createAirlineDto, lang);
  }

  @Get('airlines')
  @ApiOperation({
    summary: 'Get all airlines with pagination and search',
    description:
      'Retrieve all airlines with optional search by name and pagination support.',
  })
  @ApiResponse({
    status: 200,
    description: 'Airlines retrieved successfully (message will be translated)',
    type: GetAirlinesResponseDto,
    examples: {
      success: {
        summary: 'Airlines retrieved successfully',
        value: {
          message: 'Airlines retrieved successfully',
          airlines: [
            {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'American Airlines',
              description:
                'Major US airline serving domestic and international routes',
              created_at: '2024-01-15T10:30:00.000Z',
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174001',
              name: 'Delta Air Lines',
              description: 'American airline serving global destinations',
              created_at: '2024-01-14T09:15:00.000Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 25,
            totalPages: 3,
            hasNext: true,
            hasPrev: false,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'Failed to retrieve airlines',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getAllAirlines(
    @Query() query: GetAirlinesQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetAirlinesResponseDto> {
    return this.tripService.getAllAirlines(query, lang);
  }

  // Alert endpoints
  @Post('alerts')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create a new alert',
    description:
      'Create a new travel alert for departure and destination locations. Duplicate alerts (same user, departure, destination, and date range) are prevented. If from_date is provided, to_date must also be provided. from_date must be greater than today, and to_date must be greater than from_date.',
  })
  @ApiBody({
    type: CreateAlertDto,
    description: 'Alert creation data',
    examples: {
      basic: {
        summary: 'Basic alert',
        value: {
          depature: 'New York',
          destination: 'Los Angeles',
          notificaction: true,
        },
      },
      withFromDate: {
        summary: 'Alert with from_date only',
        value: {
          depature: 'San Francisco',
          destination: 'Seattle',
          notificaction: true,
          form_date: '2024-02-01T00:00:00.000Z',
        },
      },
      withToDate: {
        summary: 'Alert with to_date only',
        value: {
          depature: 'Miami',
          destination: 'Orlando',
          notificaction: true,
          to_date: '2024-02-15T00:00:00.000Z',
        },
      },
      withDateRange: {
        summary: 'Alert with complete date range',
        value: {
          depature: 'Paris',
          destination: 'London',
          notificaction: true,
          form_date: '2024-02-01T00:00:00.000Z',
          to_date: '2024-02-15T00:00:00.000Z',
        },
      },
      noNotifications: {
        summary: 'Alert with notifications disabled',
        value: {
          depature: 'Tokyo',
          destination: 'Osaka',
          notificaction: false,
          form_date: '2024-03-01T00:00:00.000Z',
          to_date: '2024-03-31T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Alert created successfully (message will be translated)',
    type: CreateAlertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'If from_date is provided, to_date must also be provided',
            'from_date must be greater than today',
            'to_date must be greater than from_date',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Duplicate alert already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: 'An alert with the same details already exists',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to create alert' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async createAlert(
    @Body() createAlertDto: CreateAlertDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CreateAlertResponseDto> {
    return this.tripService.createAlert(user.id, createAlertDto, lang);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user alerts',
    description:
      'Retrieve all alerts for the authenticated user with pagination and search functionality.',
  })
  @ApiResponse({
    status: 200,
    description: 'Alerts retrieved successfully (message will be translated)',
    type: GetAlertsResponseDto,
    examples: {
      success: {
        summary: 'Alerts retrieved successfully',
        value: {
          message: 'Alerts retrieved successfully',
          alerts: [
            {
              id: '123e4567-e89b-12d3-a456-426614174000',
              user_id: '123e4567-e89b-12d3-a456-426614174001',
              depature: 'New York',
              destination: 'Los Angeles',
              notificaction: true,
              form_date: '2024-01-15T00:00:00.000Z',
              to_date: '2024-01-20T00:00:00.000Z',
              created_at: '2024-01-10T10:00:00.000Z',
              updated_at: '2024-01-10T10:00:00.000Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to retrieve alerts' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getUserAlerts(
    @Query() query: GetAlertsQueryDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetAlertsResponseDto> {
    return this.tripService.getUserAlerts(user.id, query, lang);
  }

  @Patch('alerts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update an alert',
    description:
      'Update an existing alert. Only the alert owner can update it. If from_date is provided, to_date must also be provided. from_date must be greater than today, and to_date must be greater than from_date.',
  })
  @ApiParam({
    name: 'id',
    description: 'Alert ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateAlertDto,
    description: 'Alert update data',
    examples: {
      updateLocation: {
        summary: 'Update departure and destination',
        value: {
          depature: 'San Francisco',
          destination: 'Seattle',
        },
      },
      updateNotification: {
        summary: 'Update notification setting',
        value: {
          notificaction: false,
        },
      },
      updateDates: {
        summary: 'Update date range',
        value: {
          form_date: '2024-03-01T00:00:00.000Z',
          to_date: '2024-03-31T00:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Alert updated successfully (message will be translated)',
    type: UpdateAlertResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'If from_date is provided, to_date must also be provided',
            'from_date must be greater than today',
            'to_date must be greater than from_date',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Alert not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to update alert' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async updateAlert(
    @Param('id') alertId: string,
    @Body() updateAlertDto: UpdateAlertDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<UpdateAlertResponseDto> {
    return this.tripService.updateAlert(alertId, user.id, updateAlertDto, lang);
  }

  @Delete('alerts/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete an alert',
    description:
      'Delete an existing alert. Only the alert owner can delete it.',
  })
  @ApiParam({
    name: 'id',
    description: 'Alert ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert deleted successfully (message will be translated)',
    type: DeleteAlertResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Alert not found (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Alert not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to delete alert' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async deleteAlert(
    @Param('id') alertId: string,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<DeleteAlertResponseDto> {
    return this.tripService.deleteAlert(alertId, user.id, lang);
  }
}
