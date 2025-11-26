import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ChatService } from '../chat/chat.service';
import {
  CreateRideTripDto,
  CreateRideTripResponseDto,
  TransportMode,
} from './dto/create-ride-trip.dto';
import {
  SearchRideTripsDto,
  SearchRideTripsResponseDto,
  RideTripSearchResultDto,
} from './dto/search-ride-trips.dto';
import { GetRideTripDetailResponseDto } from './dto/get-ride-trip-detail.dto';
import { GetMyRideTripsDto, GetMyRideTripsResponseDto, MyTripsFilter } from './dto/get-my-ride-trips.dto';
import { CancelRideTripResponseDto } from './dto/cancel-ride-trip.dto';
import { CreateIssueReportDto, CreateIssueReportResponseDto } from './dto/create-issue-report.dto';
import { CreateChatForRideDto, CreateChatForRideResponseDto } from './dto/create-chat-for-ride.dto';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly chatService: ChatService,
  ) {}

  private mapTransportMode(mode: string): TransportMode {
    return mode as TransportMode;
  }

  /**
   * Create a new ride trip
   */
  async createRideTrip(
    userId: string,
    createDto: CreateRideTripDto,
  ): Promise<CreateRideTripResponseDto> {
    // Validate departure datetime is in the future
    const departureDate = new Date(createDto.departure_datetime);
    if (Number.isNaN(departureDate.getTime())) {
      throw new BadRequestException('Invalid departure datetime');
    }
    if (departureDate <= new Date()) {
      throw new BadRequestException('Departure datetime must be in the future');
    }

    // Create trip with stops in a transaction
    const trip = await this.prisma.$transaction(async (prisma) => {
      const newTrip = await prisma.rideTrip.create({
        data: {
          driver_id: userId,
          transport_mode: createDto.transport_mode as any,
          departure_location: createDto.departure_location,
          arrival_location: createDto.arrival_location,
          departure_datetime: departureDate,
          seats_available: createDto.seats_available,
          base_price_per_seat: createDto.base_price_per_seat,
          driver_message: createDto.driver_message || null,
          status: 'PUBLISHED' as any,
        },
        select: {
          id: true,
          driver_id: true,
          transport_mode: true,
          departure_location: true,
          arrival_location: true,
          departure_datetime: true,
          seats_available: true,
          base_price_per_seat: true,
          status: true,
        },
      });

      // Create stops if provided
      if (createDto.stops && createDto.stops.length > 0) {
        await prisma.rideTripStop.createMany({
          data: createDto.stops.map((stop, index) => ({
            ride_trip_id: newTrip.id,
            stop_order: index,
            stop_location: stop.stop_location,
            price_per_seat_to_stop: stop.price_per_seat_to_stop || null,
          })),
        });
      }

      return newTrip;
    });

    return {
      message: 'Trip created successfully',
      trip: {
        id: trip.id,
        driver_id: trip.driver_id,
        transport_mode: this.mapTransportMode(trip.transport_mode),
        departure_location: trip.departure_location as any,
        arrival_location: trip.arrival_location as any,
        departure_datetime: trip.departure_datetime,
        seats_available: trip.seats_available,
        base_price_per_seat: Number(trip.base_price_per_seat),
        status: trip.status,
      } as any,
    };
  }

  /**
   * Search ride trips
   */
  async searchRideTrips(
    searchDto: SearchRideTripsDto,
  ): Promise<SearchRideTripsResponseDto> {
    // Build where clause
    const where: any = {
      status: 'PUBLISHED' as any,
    };

    if (searchDto.transport_mode) {
      where.transport_mode = searchDto.transport_mode as any;
    }

    // Handle date filtering: support both single date and date range
    if (searchDto.from_date && searchDto.to_date) {
      // Date range filter
      const fromDate = new Date(searchDto.from_date);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(searchDto.to_date);
      toDate.setHours(23, 59, 59, 999);
      where.departure_datetime = {
        gte: fromDate,
        lte: toDate,
      };
    } else if (searchDto.from_date) {
      // Only from_date provided
      const fromDate = new Date(searchDto.from_date);
      fromDate.setHours(0, 0, 0, 0);
      where.departure_datetime = {
        gte: fromDate,
      };
    } else if (searchDto.to_date) {
      // Only to_date provided
      const toDate = new Date(searchDto.to_date);
      toDate.setHours(23, 59, 59, 999);
      where.departure_datetime = {
        lte: toDate,
      };
    } else if (searchDto.date) {
      // Single date filter (backward compatibility)
      const date = new Date(searchDto.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.departure_datetime = {
        gte: date,
        lt: nextDay,
      };
    }

    // Filter by minimum seats available
    if (searchDto.seats_needed !== undefined && searchDto.seats_needed > 0) {
      where.seats_available = {
        gte: searchDto.seats_needed,
      };
    }

    // Get all published trips matching filters
    const trips = await this.prisma.rideTrip.findMany({
      where,
      include: {
        stops: {
          orderBy: {
            stop_order: 'asc',
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            picture: true,
          },
        },
      },
      orderBy: {
        departure_datetime: 'asc',
      },
    });

    // Filter trips by location text if provided
    let filteredTrips = trips;
    if (searchDto.from_text || searchDto.to_text) {
      filteredTrips = trips.filter((trip) => {
        const departureLoc = trip.departure_location as any;
        const arrivalLoc = trip.arrival_location as any;
        
        // Check from_text match
        if (searchDto.from_text) {
          const fromText = searchDto.from_text.toLowerCase();
          const departureMatch = 
            (departureLoc?.country?.toLowerCase().includes(fromText) ||
             departureLoc?.region?.toLowerCase().includes(fromText) ||
             departureLoc?.address?.toLowerCase().includes(fromText) ||
             departureLoc?.city?.toLowerCase().includes(fromText));
          
          if (!departureMatch) return false;
        }
        
        // Check to_text match
        if (searchDto.to_text) {
          const toText = searchDto.to_text.toLowerCase();
          const arrivalMatch = 
            (arrivalLoc?.country?.toLowerCase().includes(toText) ||
             arrivalLoc?.region?.toLowerCase().includes(toText) ||
             arrivalLoc?.address?.toLowerCase().includes(toText) ||
             arrivalLoc?.city?.toLowerCase().includes(toText));
          
          if (!arrivalMatch) return false;
        }
        
        return true;
      });
    }

    // Batch KYC checks and ratings for all drivers
    const driverIds = [...new Set(filteredTrips.map((t) => t.driver_id))];
    const [kycRecords, driverRatings, driverTripCounts] = await Promise.all([
      this.prisma.userKYC.findMany({
        where: {
          userId: { in: driverIds },
          status: 'APPROVED',
        },
        select: { userId: true },
      }),
      // Get all ratings for these drivers (from regular trips - Rating model)
      this.prisma.rating.findMany({
        where: {
          receiver_id: { in: driverIds },
        },
        select: {
          receiver_id: true,
          rating: true,
        },
      }),
      // Count ride trips for each driver
      this.prisma.rideTrip.groupBy({
        by: ['driver_id'],
        where: {
          driver_id: { in: driverIds },
        },
        _count: true,
      }),
    ]);
    const verifiedDriverIds = new Set(kycRecords.map((r) => r.userId));
    
    // Calculate average ratings per driver
    const driverRatingMap = new Map<string, { average: number; count: number }>();
    driverIds.forEach((driverId) => {
      const ratings = driverRatings.filter((r) => r.receiver_id === driverId);
      const average = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;
      driverRatingMap.set(driverId, { average, count: ratings.length });
    });
    
    // Create trip count map
    const driverTripCountMap = new Map<string, number>();
    driverTripCounts.forEach((count) => {
      driverTripCountMap.set(count.driver_id, count._count);
    });

    // Calculate segment price for each trip (for now, just base price or stop price if any)
    const results: RideTripSearchResultDto[] = filteredTrips.map((trip) => {
      let segmentPrice = Number(trip.base_price_per_seat);
      if (trip.stops.length > 0) {
        const lastStop = trip.stops[trip.stops.length - 1];
        if (lastStop.price_per_seat_to_stop !== null) {
          segmentPrice = Number(lastStop.price_per_seat_to_stop);
        }
      }

      const driverRating = driverRatingMap.get(trip.driver_id) || { average: 0, count: 0 };
      const totalTrips = driverTripCountMap.get(trip.driver_id) || 0;
      
      return {
        id: trip.id,
        driver: {
          id: trip.driver.id,
          name: trip.driver.name || 'Unknown',
          picture: trip.driver.picture || null,
          is_kyc_verified: verifiedDriverIds.has(trip.driver_id),
          average_rating: driverRating.average > 0 ? Number(driverRating.average.toFixed(1)) : undefined,
          total_trips: totalTrips > 0 ? totalTrips : undefined,
        },
        transport_mode: this.mapTransportMode(trip.transport_mode),
        route: {
          departure_location: trip.departure_location as any,
          arrival_location: trip.arrival_location as any,
          stops: trip.stops.map((s) => ({
            stop_location: s.stop_location as any,
            price_per_seat_to_stop:
              s.price_per_seat_to_stop !== null
                ? Number(s.price_per_seat_to_stop)
                : undefined,
          })),
        },
        departure_datetime: trip.departure_datetime,
        seats_available: trip.seats_available,
        segment_price: segmentPrice,
        status: trip.status,
      };
    });

    return {
      trips: results,
      total: results.length,
    };
  }

  /**
   * Get ride trip detail
   */
  async getRideTripDetail(tripId: string): Promise<GetRideTripDetailResponseDto> {
    const trip = await this.prisma.rideTrip.findUnique({
      where: { id: tripId },
      include: {
        stops: {
          orderBy: {
            stop_order: 'asc',
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            picture: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Get driver stats (KYC, ratings, trip count)
    const [kycRecord, driverRatings, driverTripCount] = await Promise.all([
      this.prisma.userKYC.findFirst({
        where: {
          userId: trip.driver_id,
          status: 'APPROVED',
        },
      }),
      // Get all ratings for this driver (from regular trips)
      this.prisma.rating.findMany({
        where: {
          receiver_id: trip.driver_id,
        },
        select: {
          rating: true,
        },
      }),
      // Count ride trips for this driver
      this.prisma.rideTrip.count({
        where: {
          driver_id: trip.driver_id,
        },
      }),
    ]);

    // Calculate average rating
    const averageRating = driverRatings.length > 0
      ? driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length
      : 0;

    return {
      trip: {
        id: trip.id,
        driver: {
          id: trip.driver.id,
          name: trip.driver.name || 'Unknown',
          picture: trip.driver.picture || null,
          is_kyc_verified: !!kycRecord,
          average_rating: averageRating > 0 ? Number(averageRating.toFixed(1)) : undefined,
          total_trips: driverTripCount > 0 ? driverTripCount : undefined,
        },
        transport_mode: this.mapTransportMode(trip.transport_mode),
        route: {
          departure_location: trip.departure_location as any,
          arrival_location: trip.arrival_location as any,
          stops: trip.stops.map((s) => ({
            stop_order: s.stop_order,
            stop_location: s.stop_location as any,
            price_per_seat_to_stop:
              s.price_per_seat_to_stop !== null
                ? Number(s.price_per_seat_to_stop)
                : undefined,
          })),
        },
        departure_datetime: trip.departure_datetime,
        seats_available: trip.seats_available,
        base_price_per_seat: Number(trip.base_price_per_seat),
        status: trip.status,
        createdAt: trip.createdAt,
      },
    };
  }

  /**
   * Get my trips (driver view)
   */
  async getMyRideTrips(
    userId: string,
    query: GetMyRideTripsDto,
  ): Promise<GetMyRideTripsResponseDto> {
    const filter = query.filter || MyTripsFilter.UPCOMING;
    const now = new Date();

    const where: any = {
      driver_id: userId,
    };

    // Filter by transport mode if specified
    if (query.transport_mode) {
      where.transport_mode = query.transport_mode as any;
    }

    // Apply status/date filters
    if (filter === MyTripsFilter.UPCOMING) {
      where.departure_datetime = { gte: now };
      where.status = { in: ['PUBLISHED', 'SCHEDULED', 'RESCHEDULED'] as any };
    } else if (filter === MyTripsFilter.PAST) {
      where.OR = [
        { departure_datetime: { lt: now } },
        { status: { in: ['COMPLETED', 'CANCELLED'] as any } },
      ];
    } else if (filter === MyTripsFilter.CAR_RIDES) {
      where.transport_mode = 'CAR' as any;
      // Don't filter by date for transport mode filters
    } else if (filter === MyTripsFilter.FLIGHT_BAGGAGE) {
      where.transport_mode = 'AIRPLANE' as any;
      // Don't filter by date for transport mode filters
    }
    // ALL: no additional filters

    const trips = await this.prisma.rideTrip.findMany({
      where,
      orderBy: {
        departure_datetime: 'desc',
      },
    });

    return {
      trips: trips.map((trip) => ({
        id: trip.id,
        transport_mode: this.mapTransportMode(trip.transport_mode),
        route: {
          departure_location: trip.departure_location as any,
          arrival_location: trip.arrival_location as any,
        },
        departure_datetime: trip.departure_datetime,
        seats_available: trip.seats_available,
        base_price_per_seat: Number(trip.base_price_per_seat),
        status: trip.status,
        createdAt: trip.createdAt,
      })),
      total: trips.length,
    };
  }

  /**
   * Cancel a ride trip
   */
  async cancelRideTrip(
    userId: string,
    tripId: string,
  ): Promise<CancelRideTripResponseDto> {
    const trip = await this.prisma.rideTrip.findUnique({
      where: { id: tripId },
      include: {
        chats: {
          include: {
            members: {
              select: {
                user_id: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.driver_id !== userId) {
      throw new ForbiddenException('Only the driver can cancel this trip');
    }

    if (trip.status === 'CANCELLED') {
      throw new BadRequestException('Trip is already cancelled');
    }

    // Update trip status
    await this.prisma.rideTrip.update({
      where: { id: tripId },
      data: {
        status: 'CANCELLED' as any,
      },
    });

    // Get all unique user IDs from conversations (excluding driver)
    const participantUserIds = new Set<string>();
    for (const chat of trip.chats) {
      for (const member of chat.members) {
        if (member.user_id !== userId) {
          participantUserIds.add(member.user_id);
        }
      }
    }

    // Send push notifications to all participants
    const departureLoc = trip.departure_location as any;
    const arrivalLoc = trip.arrival_location as any;
    const departureName = departureLoc?.address || departureLoc?.city || 'Departure';
    const arrivalName = arrivalLoc?.address || arrivalLoc?.city || 'Arrival';
    const routeText = `${departureName} → ${arrivalName}`;
    const notificationPromises = Array.from(participantUserIds).map(async (participantId) => {
      // Get user's language preference
      const user = await this.prisma.user.findUnique({
        where: { id: participantId },
        select: { lang: true },
      });
      const userLang = user?.lang || 'en';

      return this.notificationService.sendPushNotificationToUser(
        participantId,
        'Trip Cancelled',
        `Trip ${routeText} has been cancelled by the driver`,
        {
          type: 'trip_cancelled',
          trip_id: tripId,
        },
        userLang,
      );
    });

    await Promise.allSettled(notificationPromises);

    // Optionally: Insert system message in each chat
    // This can be done via chat gateway if needed

    return {
      message: 'Trip cancelled successfully',
      tripId: tripId,
    };
  }

  /**
   * Create issue report for a trip
   */
  async createIssueReport(
    userId: string,
    createDto: CreateIssueReportDto,
  ): Promise<CreateIssueReportResponseDto> {
    // Check if trip exists
    const trip = await this.prisma.rideTrip.findUnique({
      where: { id: createDto.trip_id },
      select: { driver_id: true },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Validate report type is for ride trips (matching frontend options)
    const rideTripReportTypes = [
      'DRIVER_WAS_LATE',
      'UNSAFE_DRIVING',
      'WRONG_ROUTE_TAKEN',
      'VEHICLE_CONDITION_ISSUE',
      'INAPPROPRIATE_BEHAVIOR',
      'OTHER',
    ];
    if (!rideTripReportTypes.includes(createDto.type)) {
      throw new BadRequestException(
        `Invalid report type for ride trips. Allowed types: ${rideTripReportTypes.join(', ')}`,
      );
    }

    // Create report using the unified Report model
    // For ride trips, we need to provide a valid trip_id (required by schema)
    // We'll use a placeholder approach: create a minimal Trip record or use existing
    // Actually, since trip_id is required, we can't use null. Let's check if we can make it work differently.
    // The cleanest solution: Keep trip_id required for existing, and for ride trips we'll need
    // to either create a dummy trip or handle it at the application level.
    // For now, let's use a workaround: We'll need to handle ride trip reports differently
    // OR make trip_id truly optional and update existing code to handle null
    
    // Since user wants to use same model and not break existing, let's make trip_id optional
    // but ensure existing code still works by always providing trip_id for package delivery trips
    // For ride trips, we'll set trip_id to a special value or handle it differently
    
    // Actually, the best approach: Make trip_id optional in schema but keep relation optional too
    // Then update existing code to handle null. But user said don't change existing code.
    
    // Final solution: For ride trips, we cannot use the same Report model if trip_id is required
    // We need to either:
    // 1. Make trip_id optional and update existing code (breaks "don't change existing")
    // 2. Keep trip_id required and use a workaround for ride trips
    // 3. Use separate model for ride trip reports
    
    // Since user wants unified model, let's make trip_id optional and relation optional
    // Existing code will still work because it always provides trip_id
    // We just need to handle the case where trip might be null in the response
    
    // Wait, but the user already changed relation back to required. So they want it required.
    // That means trip_id must be required too.
    
    // Final decision: Keep trip_id required (String) to match required relation
    // For ride trips, we cannot use null. We need a different approach.
    
    // Actually, let me check - if I make trip_id required, then ride trips can't use it.
    // So I should keep trip_id optional but make relation optional too, and existing code
    // will still work because it always provides trip_id.
    
    // But user changed relation to required, so they want it that way.
    
    // I think the issue is: I need to make both optional OR both required.
    // Since user changed relation to required, I should make trip_id required too.
    // But then ride trips can't work.
    
    // Let me just make trip_id required to match the relation, and note that ride trips
    // will need a different approach or we need to handle it at application level.
    
    // Actually, wait - let me re-read the user's question. They asked if we can use trip
    // in place of rideTrip. They want to unify. But trip_id pointing to Trip model won't
    // work for RideTrip model because they're different tables.
    
    // Create report using the new RideTripReport model
    const report = await this.prisma.rideTripReport.create({
      data: {
        user_id: userId,
        reported_id: trip.driver_id,
        ride_trip_id: createDto.trip_id,
        type: createDto.type as any,
        text: createDto.description || null,
        priority: 'LOW', // Default priority for ride trip reports
        status: 'PENDING',
      },
    });

    return {
      message: 'Report submitted successfully',
      reportId: report.id,
    };
  }

  /**
   * Create or find chat for a ride trip
   */
  async createChatForRide(
    userId: string,
    createDto: CreateChatForRideDto,
  ): Promise<CreateChatForRideResponseDto> {

    // Get trip with driver
    const trip = await this.prisma.rideTrip.findUnique({
      where: { id: createDto.trip_id },
      include: {
        driver: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.driver_id === userId) {
      throw new BadRequestException('Cannot chat with yourself');
    }

    // Check if chat already exists for this trip with both users
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        ride_trip_id: createDto.trip_id,
        members: {
          some: {
            user_id: userId,
          },
        },
      },
      include: {
        members: {
          select: {
            user_id: true,
          },
        },
      },
    });

    if (existingChat) {
      const memberUserIds = existingChat.members.map((m) => m.user_id);
      const bothUsersAreMembers =
        memberUserIds.includes(userId) && memberUserIds.includes(trip.driver_id);

      if (bothUsersAreMembers) {
        return {
          chatId: existingChat.id,
          message: 'Chat already exists',
        };
      }
    }

    // Create new chat
    const chat = await this.prisma.chat.create({
      data: {
        ride_trip_id: createDto.trip_id,
        type: 'TRIP',
        members: {
          create: [
            { user_id: userId },
            { user_id: trip.driver_id },
          ],
        },
      },
    });

    return {
      chatId: chat.id,
      message: 'Chat created successfully',
    };
  }
}

