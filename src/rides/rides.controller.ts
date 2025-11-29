import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { RidesService } from './rides.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import { CreateRideTripDto, CreateRideTripResponseDto } from './dto/create-ride-trip.dto';
import { SearchRideTripsDto, SearchRideTripsResponseDto } from './dto/search-ride-trips.dto';
import { GetRideTripDetailResponseDto } from './dto/get-ride-trip-detail.dto';
import { GetMyRideTripsDto, GetMyRideTripsResponseDto } from './dto/get-my-ride-trips.dto';
import { CancelRideTripResponseDto } from './dto/cancel-ride-trip.dto';
import { CreateIssueReportDto, CreateIssueReportResponseDto, CreateIssueReportBodyDto } from './dto/create-issue-report.dto';
import { CreateChatForRideDto, CreateChatForRideResponseDto } from './dto/create-chat-for-ride.dto';

@ApiTags('Rides')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post('trips')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new ride trip',
    description: 'Create a new ride trip (car or airplane) with route, stops, departure time, seats, and pricing. Only logged-in users can create trips.',
  })
  @ApiBody({ type: CreateRideTripDto })
  @ApiResponse({
    status: 201,
    description: 'Trip created successfully',
    type: CreateRideTripResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or validation errors',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['Departure and arrival cities must be different', 'Departure datetime must be in the future'],
        },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'City not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Departure city not found' },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async createRideTrip(
    @CurrentUser() user: User,
    @Body() createDto: CreateRideTripDto,
  ): Promise<CreateRideTripResponseDto> {
    return this.ridesService.createRideTrip(user.id, createDto);
  }

  @Get('trips/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search ride trips',
    description: 'Search for published ride trips by location text (country/region/address), optionally via stops. Can filter by date and transport mode. Returns matching trips with segment pricing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully',
    type: SearchRideTripsResponseDto,
  })
  async searchRideTrips(
    @Query() searchDto: SearchRideTripsDto,
  ): Promise<SearchRideTripsResponseDto> {
    return this.ridesService.searchRideTrips(searchDto);
  }

  @Get('trips/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get ride trip detail',
    description: 'Get detailed information about a specific ride trip including driver info, route, stops, pricing, and KYC verification status.',
  })
  @ApiParam({ name: 'id', description: 'Ride trip ID', example: 'trip-uuid-123' })
  @ApiResponse({
    status: 200,
    description: 'Trip details returned successfully',
    type: GetRideTripDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Trip not found' },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async getRideTripDetail(
    @Param('id') tripId: string,
  ): Promise<GetRideTripDetailResponseDto> {
    return this.ridesService.getRideTripDetail(tripId);
  }

  @Get('my-trips')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get my trips (driver view)',
    description: 'Get all trips created by the authenticated user (driver). Can filter by UPCOMING (published trips with future departure), PAST (past trips or cancelled), or ALL.',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['UPCOMING', 'PAST', 'ALL', 'CAR_RIDES', 'FLIGHT_BAGGAGE'],
    description: 'Filter trips: UPCOMING (future trips), PAST (completed/cancelled), ALL (all trips), CAR_RIDES (car trips only), FLIGHT_BAGGAGE (airplane trips only)',
    example: 'UPCOMING',
  })
  @ApiQuery({
    name: 'transport_mode',
    required: false,
    enum: ['CAR', 'AIRPLANE'],
    description: 'Filter by transport mode (optional, can be used with any filter)',
    example: 'CAR',
  })
  @ApiResponse({
    status: 200,
    description: 'My trips returned successfully',
    type: GetMyRideTripsResponseDto,
  })
  async getMyRideTrips(
    @CurrentUser() user: User,
    @Query() query: GetMyRideTripsDto,
  ): Promise<GetMyRideTripsResponseDto> {
    return this.ridesService.getMyRideTrips(user.id, query);
  }

  @Post('trips/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a ride trip',
    description: 'Cancel a ride trip. Only the driver who created the trip can cancel it. Sends push notifications to all participants in chats for this trip.',
  })
  @ApiParam({ name: 'id', description: 'Ride trip ID to cancel', example: 'trip-uuid-123' })
  @ApiResponse({
    status: 200,
    description: 'Trip cancelled successfully',
    type: CancelRideTripResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Trip is already cancelled',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Trip is already cancelled' },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Only the driver can cancel this trip',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Only the driver can cancel this trip' },
        error: { type: 'string', example: 'Forbidden' },
        statusCode: { type: 'number', example: 403 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Trip not found' },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async cancelRideTrip(
    @CurrentUser() user: User,
    @Param('id') tripId: string,
  ): Promise<CancelRideTripResponseDto> {
    return this.ridesService.cancelRideTrip(user.id, tripId);
  }

  @Post('trips/:id/report')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Report a ride trip',
    description: 'Submit a report about a ride trip (inappropriate content, fake trip, scam/fraud attempt). The trip_id is taken from the URL parameter.',
  })
  @ApiParam({ name: 'id', description: 'Ride trip ID to report', example: 'trip-uuid-123' })
  @ApiBody({
    type: CreateIssueReportBodyDto,
    description: 'Report details (trip_id is taken from URL)',
    examples: {
      driverLate: {
        summary: 'Driver was late',
        value: {
          type: 'DRIVER_WAS_LATE',
          description: 'The driver arrived significantly later than the scheduled departure time',
        },
      },
      unsafeDriving: {
        summary: 'Unsafe driving',
        value: {
          type: 'UNSAFE_DRIVING',
          description: 'The driver exhibited unsafe driving behavior during the trip',
        },
      },
      wrongRoute: {
        summary: 'Wrong route taken',
        value: {
          type: 'WRONG_ROUTE_TAKEN',
          description: 'The driver took a different route than what was specified',
        },
      },
      vehicleCondition: {
        summary: 'Vehicle condition issue',
        value: {
          type: 'VEHICLE_CONDITION_ISSUE',
          description: 'The vehicle had safety or condition issues',
        },
      },
      inappropriateBehavior: {
        summary: 'Inappropriate behavior',
        value: {
          type: 'INAPPROPRIATE_BEHAVIOR',
          description: 'The driver exhibited inappropriate behavior',
        },
      },
      other: {
        summary: 'Other issue',
        value: {
          type: 'OTHER',
          description: 'Other issue not listed above',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Report submitted successfully',
    type: CreateIssueReportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid report data',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['type must be one of the following values: DRIVER_WAS_LATE, UNSAFE_DRIVING, WRONG_ROUTE_TAKEN, VEHICLE_CONDITION_ISSUE, INAPPROPRIATE_BEHAVIOR, OTHER'],
        },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Trip not found' },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async createIssueReport(
    @CurrentUser() user: User,
    @Param('id') tripId: string,
    @Body() createDto: CreateIssueReportBodyDto,
  ): Promise<CreateIssueReportResponseDto> {
    return this.ridesService.createIssueReport(user.id, {
      ...createDto,
      trip_id: tripId,
    });
  }

  @Post('trips/:id/chat')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or get chat for a ride trip',
    description: 'Create a new chat with the driver for a ride trip, or return existing chat if one already exists. Only logged-in users can create chats.',
  })
  @ApiParam({ name: 'id', description: 'Ride trip ID', example: 'trip-uuid-123' })
  @ApiResponse({
    status: 201,
    description: 'Chat created or existing chat returned',
    type: CreateChatForRideResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot chat with yourself (user is the driver)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Cannot chat with yourself' },
        error: { type: 'string', example: 'Bad Request' },
        statusCode: { type: 'number', example: 400 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Trip not found' },
        error: { type: 'string', example: 'Not Found' },
        statusCode: { type: 'number', example: 404 },
      },
    },
  })
  async createChatForRide(
    @CurrentUser() user: User,
    @Param('id') tripId: string,
  ): Promise<CreateChatForRideResponseDto> {
    return this.ridesService.createChatForRide(user.id, {
      trip_id: tripId,
    });
  }
}

