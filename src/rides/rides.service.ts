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
import { TripStatus } from 'generated/prisma/client';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);
  private readonly RIDE_AIRLINE_NAME = 'Ride Service'; // Default airline for ride trips

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Get or create default airline for ride trips
   */
  private async getOrCreateRideAirline(): Promise<string> {
    let airline = await this.prisma.airline.findFirst({
      where: { name: this.RIDE_AIRLINE_NAME },
    });

    if (!airline) {
      airline = await this.prisma.airline.create({
        data: {
          name: this.RIDE_AIRLINE_NAME,
          description: 'Default airline for ride trips',
        },
      });
    }

    return airline.id;
  }

  /**
   * Get or create transport type for ride trips
   */
  private async getOrCreateTransportType(transportMode: TransportMode): Promise<string | null> {
    const transportTypeMap: Record<TransportMode, { name: string; description: string }> = {
      [TransportMode.CAR]: { name: 'Car', description: 'Car ride sharing' },
      [TransportMode.AIRPLANE]: { name: 'Airplane', description: 'Airplane ride sharing' },
    };

    const typeInfo = transportTypeMap[transportMode];
    if (!typeInfo) return null;

    let transportType = await this.prisma.transportType.findFirst({
      where: { name: typeInfo.name },
    });

    if (!transportType) {
      transportType = await this.prisma.transportType.create({
        data: {
          name: typeInfo.name,
          description: typeInfo.description,
        },
      });
    }

    return transportType.id;
  }

  /**
   * Extract ride-specific data from notes JSON
   */
  private extractRideData(notes: any): {
    seats_available?: number;
    base_price_per_seat?: number;
    stops?: Array<{ stop_order: number; stop_location: any; price_per_seat_to_stop?: number }>;
    driver_message?: string;
    notes?: string;
  } {
    if (!notes) return {};
    try {
      // Handle Prisma JsonValue type (can be string, object, or null)
      let parsed: any;
      if (typeof notes === 'string') {
        parsed = JSON.parse(notes);
      } else if (notes && typeof notes === 'object') {
        parsed = notes;
      } else {
        return {};
      }

      return {
        seats_available: parsed.seats_available !== undefined ? Number(parsed.seats_available) : undefined,
        base_price_per_seat: parsed.base_price_per_seat !== undefined ? Number(parsed.base_price_per_seat) : undefined,
        stops: parsed.stops || [],
        driver_message: parsed.driver_message,
        notes: parsed.notes,
      };
    } catch {
      return {};
    }
  }

  /**
   * Store ride-specific data in notes JSON
   */
  private createRideNotes(data: {
    seats_available: number;
    base_price_per_seat: number;
    stops?: Array<{ stop_location: any; price_per_seat_to_stop?: number }>;
    driver_message?: string;
    notes?: string;
  }): string {
    return JSON.stringify({
      seats_available: data.seats_available,
      base_price_per_seat: data.base_price_per_seat,
      stops: (data.stops || []).map((stop, index) => ({
        stop_order: index,
        stop_location: stop.stop_location,
        price_per_seat_to_stop: stop.price_per_seat_to_stop || null,
      })),
      driver_message: data.driver_message || null,
      notes: data.notes || null,
    });
  }

  /**
   * Convert departure_datetime to departure_date and departure_time
   */
  private parseDepartureDateTime(datetime: string): { date: Date; time: string } {
    const date = new Date(datetime);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const time = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    return { date, time };
  }

  private mapTransportMode(mode: string): TransportMode {
    return mode as TransportMode;
  }

  /**
   * Create a new ride trip (using Trip table)
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

    // Get or create default airline for rides
    const airlineId = await this.getOrCreateRideAirline();

    // Parse departure datetime
    const { date: departureDateObj, time: departureTime } = this.parseDepartureDateTime(createDto.departure_datetime);

    // Store ride-specific data in notes JSON
    const rideNotes = this.createRideNotes({
      seats_available: createDto.seats_available,
      base_price_per_seat: createDto.base_price_per_seat,
      stops: createDto.stops || [],
      driver_message: createDto.driver_message,
      notes: createDto.notes,
    });

    // Get or create transport type for this transport mode
    const transportTypeId = await this.getOrCreateTransportType(createDto.transport_mode);

    // Use provided currency or default to EUR
    const currency = createDto.currency || 'EUR';

    // Create trip using Trip table
    const trip = await this.prisma.trip.create({
      data: {
        user_id: userId,
        departure: createDto.departure_location,
        destination: createDto.arrival_location,
        departure_date: departureDateObj,
        departure_time: departureTime,
        airline_id: airlineId,
        mode_of_transport_id: transportTypeId,
        currency: currency,
        status: TripStatus.PUBLISHED,
        notes: rideNotes,
      },
      select: {
        id: true,
        user_id: true,
        departure: true,
        destination: true,
        departure_date: true,
        departure_time: true,
        status: true,
        notes: true,
      },
    });

    // Extract ride data from notes for response
    const rideData = this.extractRideData(trip.notes);

    return {
      message: 'Trip created successfully',
      trip: {
        id: trip.id,
        driver_id: trip.user_id,
        transport_mode: createDto.transport_mode,
        departure_location: trip.departure as any,
        arrival_location: trip.destination as any,
        departure_datetime: trip.departure_date,
        seats_available: rideData.seats_available || 0,
        base_price_per_seat: rideData.base_price_per_seat || 0,
        status: trip.status,
      } as any,
    };
  }

  /**
   * Search ride trips (using Trip table)
   */
  async searchRideTrips(
    searchDto: SearchRideTripsDto,
  ): Promise<SearchRideTripsResponseDto> {
    // Get transport type IDs for ride trips (CAR and AIRPLANE)
    const carTransportType = await this.prisma.transportType.findFirst({
      where: { name: 'Car' },
    });
    const airplaneTransportType = await this.prisma.transportType.findFirst({
      where: { name: 'Airplane' },
    });

    // Build where clause - filter for ride trips (have mode_of_transport_id and notes with ride data)
    const where: any = {
      status: TripStatus.PUBLISHED,
      mode_of_transport_id: { not: null }, // Ride trips have transport type
      notes: { not: null }, // Ride trips have notes with ride data
    };

    // Filter by transport mode if specified
    if (searchDto.transport_mode) {
      if (searchDto.transport_mode === TransportMode.CAR && carTransportType) {
        where.mode_of_transport_id = carTransportType.id;
      } else if (searchDto.transport_mode === TransportMode.AIRPLANE && airplaneTransportType) {
        where.mode_of_transport_id = airplaneTransportType.id;
      } else {
        // If transport mode is specified but transport type doesn't exist, 
        // don't filter by transport mode (show all ride trips)
        // where.mode_of_transport_id remains { not: null } to show all ride trips
      }
    }

    // Handle date filtering: support both single date and date range
    if (searchDto.from_date && searchDto.to_date) {
      const fromDate = new Date(searchDto.from_date);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(searchDto.to_date);
      toDate.setHours(23, 59, 59, 999);
      where.departure_date = {
        gte: fromDate,
        lte: toDate,
      };
    } else if (searchDto.from_date) {
      const fromDate = new Date(searchDto.from_date);
      fromDate.setHours(0, 0, 0, 0);
      where.departure_date = { gte: fromDate };
    } else if (searchDto.to_date) {
      const toDate = new Date(searchDto.to_date);
      toDate.setHours(23, 59, 59, 999);
      where.departure_date = { lte: toDate };
    } else if (searchDto.date) {
      const date = new Date(searchDto.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.departure_date = {
        gte: date,
        lt: nextDay,
      };
    }

    // Get all published ride trips matching filters
    const trips = await this.prisma.trip.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            picture: true,
          },
        },
        mode_of_transport: true,
      },
      orderBy: {
        departure_date: 'asc',
      },
    });

    // Filter trips by location text and seats if provided, and extract ride data
      let filteredTrips = trips
        .map((trip) => {
          const rideData = this.extractRideData(trip.notes);
          return { ...trip, rideData };
        })
      .filter((trip) => {
        // Filter by minimum seats available
        if (searchDto.seats_needed !== undefined && searchDto.seats_needed > 0) {
          if (!trip.rideData.seats_available || trip.rideData.seats_available < searchDto.seats_needed) {
            return false;
          }
        }

        // Filter by location text if provided
        if (searchDto.from_text || searchDto.to_text) {
          const departureLoc = trip.departure as any;
          const arrivalLoc = trip.destination as any;
          
          if (searchDto.from_text) {
            const fromText = searchDto.from_text.toLowerCase();
            const departureMatch = 
              (departureLoc?.country?.toLowerCase().includes(fromText) ||
               departureLoc?.region?.toLowerCase().includes(fromText) ||
               departureLoc?.address?.toLowerCase().includes(fromText) ||
               departureLoc?.city?.toLowerCase().includes(fromText));
            
            if (!departureMatch) {
              return false;
            }
          }
          
          if (searchDto.to_text) {
            const toText = searchDto.to_text.toLowerCase();
            const arrivalMatch = 
              (arrivalLoc?.country?.toLowerCase().includes(toText) ||
               arrivalLoc?.region?.toLowerCase().includes(toText) ||
               arrivalLoc?.address?.toLowerCase().includes(toText) ||
               arrivalLoc?.city?.toLowerCase().includes(toText));
            
            if (!arrivalMatch) {
              return false;
            }
          }
        }
        
        return true;
      });

    // Batch KYC checks and ratings for all drivers
    const driverIds = [...new Set(filteredTrips.map((t) => t.user_id))];
    const [kycRecords, driverRatings, driverTripCounts] = await Promise.all([
      this.prisma.userKYC.findMany({
        where: {
          userId: { in: driverIds },
          status: 'APPROVED',
        },
        select: { userId: true },
      }),
      this.prisma.rating.findMany({
        where: {
          receiver_id: { in: driverIds },
        },
        select: {
          receiver_id: true,
          rating: true,
        },
      }),
      // Count ride trips for each driver (trips with mode_of_transport_id and notes)
      this.prisma.trip.groupBy({
        by: ['user_id'],
        where: {
          user_id: { in: driverIds },
          mode_of_transport_id: { not: null },
          notes: { not: null },
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
      driverTripCountMap.set(count.user_id, count._count);
    });

    // Map to response format
    const results: RideTripSearchResultDto[] = filteredTrips.map((trip) => {
      const rideData = trip.rideData;
      const stops = rideData.stops || [];
      
      // Determine transport mode from transport type name
      let transportMode = TransportMode.CAR;
      if (trip.mode_of_transport?.name?.toLowerCase().includes('airplane')) {
        transportMode = TransportMode.AIRPLANE;
      }

      // Calculate segment price
      let segmentPrice = rideData.base_price_per_seat || 0;
      if (stops.length > 0) {
        const lastStop = stops[stops.length - 1];
        if (lastStop.price_per_seat_to_stop) {
          segmentPrice = lastStop.price_per_seat_to_stop;
        }
      }

      const driverRating = driverRatingMap.get(trip.user_id) || { average: 0, count: 0 };
      const totalTrips = driverTripCountMap.get(trip.user_id) || 0;
      
      return {
        id: trip.id,
        driver: {
          id: trip.user.id,
          name: trip.user.name || 'Unknown',
          picture: trip.user.picture || null,
          is_kyc_verified: verifiedDriverIds.has(trip.user_id),
          average_rating: driverRating.average > 0 ? Number(driverRating.average.toFixed(1)) : undefined,
          total_trips: totalTrips > 0 ? totalTrips : undefined,
        },
        transport_mode: transportMode,
        route: {
          departure_location: trip.departure as any,
          arrival_location: trip.destination as any,
          stops: stops.map((s: any) => ({
            stop_location: s.stop_location,
            price_per_seat_to_stop: s.price_per_seat_to_stop || undefined,
          })),
        },
        departure_datetime: trip.departure_date,
        seats_available: rideData.seats_available || 0,
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
   * Get ride trip detail (using Trip table)
   */
  async getRideTripDetail(tripId: string): Promise<GetRideTripDetailResponseDto> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            picture: true,
          },
        },
        mode_of_transport: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Verify this is a ride trip (has notes with ride data)
    const rideData = this.extractRideData(trip.notes);
    if (!rideData.seats_available && !rideData.base_price_per_seat) {
      throw new NotFoundException('Trip not found');
    }

    // Determine transport mode from transport type
    let transportMode = TransportMode.CAR;
    if (trip.mode_of_transport?.name?.toLowerCase().includes('airplane')) {
      transportMode = TransportMode.AIRPLANE;
    }

    // Get driver stats (KYC, ratings, trip count)
    const [kycRecord, driverRatings, driverTripCount] = await Promise.all([
      this.prisma.userKYC.findFirst({
        where: {
          userId: trip.user_id,
          status: 'APPROVED',
        },
      }),
      this.prisma.rating.findMany({
        where: {
          receiver_id: trip.user_id,
        },
        select: {
          rating: true,
        },
      }),
      // Count ride trips for this driver
      this.prisma.trip.count({
        where: {
          user_id: trip.user_id,
          mode_of_transport_id: { not: null },
          notes: { not: null },
        },
      }),
    ]);

    // Calculate average rating
    const averageRating = driverRatings.length > 0
      ? driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length
      : 0;

    const stops = rideData.stops || [];

    return {
      trip: {
        id: trip.id,
        driver: {
          id: trip.user.id,
          name: trip.user.name || 'Unknown',
          picture: trip.user.picture || null,
          is_kyc_verified: !!kycRecord,
          average_rating: averageRating > 0 ? Number(averageRating.toFixed(1)) : undefined,
          total_trips: driverTripCount > 0 ? driverTripCount : undefined,
        },
        transport_mode: transportMode,
        route: {
          departure_location: trip.departure as any,
          arrival_location: trip.destination as any,
          stops: stops.map((s: any, index: number) => ({
            stop_order: s.stop_order !== undefined ? s.stop_order : index,
            stop_location: s.stop_location,
            price_per_seat_to_stop: s.price_per_seat_to_stop || undefined,
          })),
        },
        departure_datetime: trip.departure_date,
        seats_available: rideData.seats_available || 0,
        base_price_per_seat: rideData.base_price_per_seat || 0,
        currency: trip.currency,
        driver_message: rideData.driver_message,
        notes: rideData.notes,
        status: trip.status,
        createdAt: trip.createdAt,
      },
    };
  }

  /**
   * Get my trips (driver view) - using Trip table
   */
  async getMyRideTrips(
    userId: string,
    query: GetMyRideTripsDto,
  ): Promise<GetMyRideTripsResponseDto> {
    const filter = query.filter || MyTripsFilter.UPCOMING;
    const now = new Date();

    // Get transport type IDs
    const carTransportType = await this.prisma.transportType.findFirst({
      where: { name: 'Car' },
    });
    const airplaneTransportType = await this.prisma.transportType.findFirst({
      where: { name: 'Airplane' },
    });

    const where: any = {
      user_id: userId,
      mode_of_transport_id: { not: null }, // Ride trips have transport type
      notes: { not: null }, // Ride trips have notes
    };

    // Filter by transport mode if specified
    if (query.transport_mode) {
      if (query.transport_mode === TransportMode.CAR && carTransportType) {
        where.mode_of_transport_id = carTransportType.id;
      } else if (query.transport_mode === TransportMode.AIRPLANE && airplaneTransportType) {
        where.mode_of_transport_id = airplaneTransportType.id;
      }
    }

    // Apply status/date filters
    if (filter === MyTripsFilter.UPCOMING) {
      where.departure_date = { gte: now };
      where.status = { in: [TripStatus.PUBLISHED, TripStatus.SCHEDULED, TripStatus.RESCHEDULED] };
    } else if (filter === MyTripsFilter.PAST) {
      where.OR = [
        { departure_date: { lt: now } },
        { status: { in: [TripStatus.COMPLETED, TripStatus.CANCELLED] } },
      ];
    } else if (filter === MyTripsFilter.CAR_RIDES && carTransportType) {
      where.mode_of_transport_id = carTransportType.id;
    } else if (filter === MyTripsFilter.FLIGHT_BAGGAGE && airplaneTransportType) {
      where.mode_of_transport_id = airplaneTransportType.id;
    }
    // ALL: no additional filters

    const trips = await this.prisma.trip.findMany({
      where,
      include: {
        mode_of_transport: true,
      },
      orderBy: {
        departure_date: 'desc',
      },
    });

    return {
      trips: trips.map((trip) => {
        const rideData = this.extractRideData(trip.notes);
        let transportMode = TransportMode.CAR;
        if (trip.mode_of_transport?.name?.toLowerCase().includes('airplane')) {
          transportMode = TransportMode.AIRPLANE;
        }

        return {
          id: trip.id,
          transport_mode: transportMode,
          route: {
            departure_location: trip.departure as any,
            arrival_location: trip.destination as any,
          },
          departure_datetime: trip.departure_date,
          seats_available: rideData.seats_available || 0,
          base_price_per_seat: rideData.base_price_per_seat || 0,
          status: trip.status,
          createdAt: trip.createdAt,
        };
      }),
      total: trips.length,
    };
  }

  /**
   * Cancel a ride trip (using Trip table)
   */
  async cancelRideTrip(
    userId: string,
    tripId: string,
  ): Promise<CancelRideTripResponseDto> {
    const trip = await this.prisma.trip.findUnique({
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

    // Verify this is a ride trip
    const rideData = this.extractRideData(trip.notes);
    if (!rideData.seats_available && !rideData.base_price_per_seat) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.user_id !== userId) {
      throw new ForbiddenException('Only the driver can cancel this trip');
    }

    if (trip.status === TripStatus.CANCELLED) {
      throw new BadRequestException('Trip is already cancelled');
    }

    // Update trip status
    await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: TripStatus.CANCELLED,
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
    const departureLoc = trip.departure as any;
    const arrivalLoc = trip.destination as any;
    const departureName = departureLoc?.address || departureLoc?.city || 'Departure';
    const arrivalName = arrivalLoc?.address || arrivalLoc?.city || 'Arrival';
    const routeText = `${departureName} → ${arrivalName}`;
    const notificationPromises = Array.from(participantUserIds).map(async (participantId) => {
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

    return {
      message: 'Trip cancelled successfully',
      tripId: tripId,
    };
  }

  /**
   * Create issue report for a ride trip (using Trip table and Report model)
   */
  async createIssueReport(
    userId: string,
    createDto: CreateIssueReportDto,
  ): Promise<CreateIssueReportResponseDto> {
    // Check if trip exists and is a ride trip
    const trip = await this.prisma.trip.findUnique({
      where: { id: createDto.trip_id },
      select: { user_id: true, notes: true },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Verify this is a ride trip
    const rideData = this.extractRideData(trip.notes);
    if (!rideData.seats_available && !rideData.base_price_per_seat) {
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
    const report = await this.prisma.report.create({
      data: {
        user_id: userId,
        reported_id: trip.user_id, // Driver is the reported user
        trip_id: createDto.trip_id,
        type: createDto.type as any,
        text: createDto.description || null,
        priority: 'LOW',
        status: 'PENDING',
      },
    });

    return {
      message: 'Report submitted successfully',
      reportId: report.id,
    };
  }

  /**
   * Create or find chat for a ride trip (using Trip table)
   */
  async createChatForRide(
    userId: string,
    createDto: CreateChatForRideDto,
  ): Promise<CreateChatForRideResponseDto> {
    // Get trip with driver
    const trip = await this.prisma.trip.findUnique({
      where: { id: createDto.trip_id },
      include: {
        user: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Verify this is a ride trip
    const rideData = this.extractRideData(trip.notes);
    if (!rideData.seats_available && !rideData.base_price_per_seat) {
      throw new NotFoundException('Trip not found');
    }

    if (trip.user_id === userId) {
      throw new BadRequestException('Cannot chat with yourself');
    }

    // Check if chat already exists for this trip with both users
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        trip_id: createDto.trip_id,
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
        memberUserIds.includes(userId) && memberUserIds.includes(trip.user_id);

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
        trip_id: createDto.trip_id,
        type: 'TRIP',
        members: {
          create: [
            { user_id: userId },
            { user_id: trip.user_id },
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

