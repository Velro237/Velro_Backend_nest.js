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
  CreateBoatShipmentDto,
  CreateBoatShipmentResponseDto,
} from './dto/create-boat-shipment.dto';
import {
  SearchBoatShipmentsDto,
  SearchBoatShipmentsResponseDto,
} from './dto/search-boat-shipments.dto';
import { GetBoatShipmentDetailResponseDto } from './dto/get-boat-shipment-detail.dto';
import {
  GetMyBoatShipmentsDto,
  GetMyBoatShipmentsResponseDto,
  MyShipmentsFilter,
} from './dto/get-my-boat-shipments.dto';
import { CancelBoatShipmentResponseDto } from './dto/cancel-boat-shipment.dto';
import {
  CreateChatForBoatDto,
  CreateChatForBoatResponseDto,
} from './dto/create-chat-for-boat.dto';
import {
  CreateIssueReportDto,
  CreateIssueReportResponseDto,
} from './dto/create-issue-report.dto';
import { TripStatus } from 'generated/prisma/client';

@Injectable()
export class BoatsService {
  private readonly logger = new Logger(BoatsService.name);
  private readonly BOAT_AIRLINE_NAME = 'Sea Freight Service'; // Default airline for boat shipments
  private readonly BOAT_TRANSPORT_TYPE_NAME = 'Boat'; // Transport type name for boats

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Get or create default airline for boat shipments
   */
  private async getOrCreateBoatAirline(): Promise<string> {
    let airline = await this.prisma.airline.findFirst({
      where: { name: this.BOAT_AIRLINE_NAME },
    });

    if (!airline) {
      airline = await this.prisma.airline.create({
        data: {
          name: this.BOAT_AIRLINE_NAME,
          description: 'Default airline for sea freight shipments',
        },
      });
    }

    return airline.id;
  }

  /**
   * Get or create transport type for boat shipments
   */
  private async getOrCreateBoatTransportType(): Promise<string | null> {
    let transportType = await this.prisma.transportType.findFirst({
      where: { name: this.BOAT_TRANSPORT_TYPE_NAME },
    });

    if (!transportType) {
      transportType = await this.prisma.transportType.create({
        data: {
          name: this.BOAT_TRANSPORT_TYPE_NAME,
          description: 'Sea freight / Boat shipment',
        },
      });
    }

    return transportType.id;
  }

  /**
   * Extract boat-specific data from notes JSON
   */
  private extractBoatData(notes: any): {
    capacity_in_cubic_meters?: number;
    max_capacity_in_cubic_meters?: number;
    price_per_cubic_meter?: number;
    notes_for_senders?: string;
  } {
    if (!notes) return {};
    try {
      let parsed: any;
      if (typeof notes === 'string') {
        parsed = JSON.parse(notes);
      } else if (notes && typeof notes === 'object') {
        parsed = notes;
      } else {
        return {};
      }

      return {
        capacity_in_cubic_meters:
          parsed.capacity_in_cubic_meters !== undefined
            ? Number(parsed.capacity_in_cubic_meters)
            : undefined,
        max_capacity_in_cubic_meters:
          parsed.max_capacity_in_cubic_meters !== undefined
            ? Number(parsed.max_capacity_in_cubic_meters)
            : undefined,
        price_per_cubic_meter:
          parsed.price_per_cubic_meter !== undefined
            ? Number(parsed.price_per_cubic_meter)
            : undefined,
        notes_for_senders: parsed.notes_for_senders || null,
      };
    } catch {
      return {};
    }
  }

  /**
   * Store boat-specific data in notes JSON
   */
  private createBoatNotes(data: {
    capacity_in_cubic_meters: number;
    max_capacity_in_cubic_meters: number;
    price_per_cubic_meter: number;
    notes_for_senders?: string;
  }): string {
    return JSON.stringify({
      capacity_in_cubic_meters: data.capacity_in_cubic_meters,
      max_capacity_in_cubic_meters: data.max_capacity_in_cubic_meters,
      price_per_cubic_meter: data.price_per_cubic_meter,
      notes_for_senders: data.notes_for_senders || null,
    });
  }

  /**
   * Calculate duration in days between two dates
   */
  private calculateDurationDays(departureDate: Date, arrivalDate: Date): number {
    const diffTime = arrivalDate.getTime() - departureDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  /**
   * Parse date to departure_time format (for consistency with Trip model)
   */
  private parseDateToTime(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  /**
   * Create a new boat shipment (using Trip table)
   */
  async createBoatShipment(
    userId: string,
    createDto: CreateBoatShipmentDto,
  ): Promise<CreateBoatShipmentResponseDto> {
    // Validate dates
    const departureDate = new Date(createDto.departure_date);
    const arrivalDate = new Date(createDto.arrival_date);

    if (Number.isNaN(departureDate.getTime())) {
      throw new BadRequestException('Invalid departure date');
    }
    if (Number.isNaN(arrivalDate.getTime())) {
      throw new BadRequestException('Invalid arrival date');
    }
    if (departureDate <= new Date()) {
      throw new BadRequestException('Departure date must be in the future');
    }
    if (arrivalDate <= departureDate) {
      throw new BadRequestException('Arrival date must be after departure date');
    }

    // Validate capacity
    if (createDto.capacity_in_cubic_meters > createDto.max_capacity_in_cubic_meters) {
      throw new BadRequestException(
        'Available capacity cannot exceed maximum capacity',
      );
    }

    // Get or create default airline for boats
    const airlineId = await this.getOrCreateBoatAirline();

    // Get or create transport type for boats
    const transportTypeId = await this.getOrCreateBoatTransportType();

    // Calculate duration
    const durationDays = this.calculateDurationDays(departureDate, arrivalDate);

    // Store boat-specific data in notes JSON
    const boatNotes = this.createBoatNotes({
      capacity_in_cubic_meters: createDto.capacity_in_cubic_meters,
      max_capacity_in_cubic_meters: createDto.max_capacity_in_cubic_meters,
      price_per_cubic_meter: createDto.price_per_cubic_meter,
      notes_for_senders: createDto.notes_for_senders,
    });

    // Create trip using Trip table
    const trip = await this.prisma.trip.create({
      data: {
        user_id: userId,
        departure: createDto.departure_port,
        destination: createDto.arrival_port,
        departure_date: departureDate,
        departure_time: this.parseDateToTime(departureDate),
        arrival_date: arrivalDate,
        arrival_time: this.parseDateToTime(arrivalDate),
        airline_id: airlineId,
        mode_of_transport_id: transportTypeId,
        currency: createDto.currency as any,
        status: TripStatus.PUBLISHED,
        notes: boatNotes,
      },
      select: {
        id: true,
        user_id: true,
        departure: true,
        destination: true,
        departure_date: true,
        arrival_date: true,
        currency: true,
        status: true,
        notes: true,
      },
    });

    // Extract boat data from notes for response
    const boatData = this.extractBoatData(trip.notes);

    return {
      message: 'Shipment created successfully',
      shipment: {
        id: trip.id,
        ship_owner_id: trip.user_id,
        departure_port: trip.departure as any,
        arrival_port: trip.destination as any,
        departure_date: trip.departure_date,
        arrival_date: trip.arrival_date!,
        capacity_in_cubic_meters: boatData.capacity_in_cubic_meters || 0,
        max_capacity_in_cubic_meters: boatData.max_capacity_in_cubic_meters || 0,
        price_per_cubic_meter: boatData.price_per_cubic_meter || 0,
        currency: trip.currency,
        status: trip.status,
        duration_days: durationDays,
      } as any,
    };
  }

  /**
   * Search boat shipments (using Trip table)
   */
  async searchBoatShipments(
    searchDto: SearchBoatShipmentsDto,
  ): Promise<SearchBoatShipmentsResponseDto> {
    // Get boat transport type
    const boatTransportType = await this.prisma.transportType.findFirst({
      where: { name: this.BOAT_TRANSPORT_TYPE_NAME },
    });

    if (!boatTransportType) {
      return { shipments: [], total: 0 };
    }

    // Build where clause - filter for boat shipments
    const where: any = {
      status: TripStatus.PUBLISHED,
      mode_of_transport_id: boatTransportType.id,
      notes: { not: null },
    };

    // Handle date filtering
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

    // Get all published boat shipments matching filters
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

    // Filter trips by location text and capacity if provided
    let filteredTrips = trips
      .map((trip) => {
        const boatData = this.extractBoatData(trip.notes);
        return { ...trip, boatData };
      })
      .filter((trip) => {
        // Filter by minimum capacity available
        if (
          searchDto.capacity_needed !== undefined &&
          searchDto.capacity_needed > 0
        ) {
          if (
            !trip.boatData.capacity_in_cubic_meters ||
            trip.boatData.capacity_in_cubic_meters < searchDto.capacity_needed
          ) {
            return false;
          }
        }

        // Filter by location text if provided
        if (searchDto.from_text || searchDto.to_text) {
          const departurePort = trip.departure as any;
          const arrivalPort = trip.destination as any;

          if (searchDto.from_text) {
            const fromText = searchDto.from_text.toLowerCase();
            const departureMatch =
              departurePort?.country?.toLowerCase().includes(fromText) ||
              departurePort?.region?.toLowerCase().includes(fromText) ||
              departurePort?.address?.toLowerCase().includes(fromText) ||
              departurePort?.city?.toLowerCase().includes(fromText);

            if (!departureMatch) {
              return false;
            }
          }

          if (searchDto.to_text) {
            const toText = searchDto.to_text.toLowerCase();
            const arrivalMatch =
              arrivalPort?.country?.toLowerCase().includes(toText) ||
              arrivalPort?.region?.toLowerCase().includes(toText) ||
              arrivalPort?.address?.toLowerCase().includes(toText) ||
              arrivalPort?.city?.toLowerCase().includes(toText);

            if (!arrivalMatch) {
              return false;
            }
          }
        }

        return true;
      });

    // Get user ratings for ship owners
    const userIds = filteredTrips.map((trip) => trip.user_id);
    const ratings = await this.prisma.rating.findMany({
      where: {
        receiver_id: { in: userIds },
      },
      select: {
        receiver_id: true,
        rating: true,
      },
    });

    const ratingsByUser = ratings.reduce((acc, rating) => {
      if (!acc[rating.receiver_id]) {
        acc[rating.receiver_id] = [];
      }
      acc[rating.receiver_id].push(rating.rating);
      return acc;
    }, {} as Record<string, number[]>);

    // Get KYC status for users
    const kycRecords = await this.prisma.userKYC.findMany({
      where: {
        userId: { in: userIds },
        status: 'APPROVED',
      },
      select: {
        userId: true,
      },
    });

    const kycVerifiedUserIds = new Set(kycRecords.map((k) => k.userId));

    // Get total shipment counts for each ship owner
    const shipmentCounts = await this.prisma.trip.groupBy({
      by: ['user_id'],
      where: {
        user_id: { in: userIds },
        mode_of_transport_id: boatTransportType.id,
      },
      _count: {
        id: true,
      },
    });

    const shipmentCountsByUser = shipmentCounts.reduce((acc, item) => {
      acc[item.user_id] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Map to response format
    const shipments = filteredTrips.map((trip) => {
      const userRatings = ratingsByUser[trip.user_id] || [];
      const averageRating =
        userRatings.length > 0
          ? userRatings.reduce((sum, r) => sum + r, 0) / userRatings.length
          : undefined;

      const durationDays = trip.arrival_date
        ? this.calculateDurationDays(trip.departure_date, trip.arrival_date)
        : 0;

      return {
        id: trip.id,
        departure_port: trip.departure as any,
        arrival_port: trip.destination as any,
        departure_date: trip.departure_date,
        arrival_date: trip.arrival_date!,
        duration_days: durationDays,
        capacity_available: trip.boatData.capacity_in_cubic_meters || 0,
        max_capacity: trip.boatData.max_capacity_in_cubic_meters || 0,
        price_per_cubic_meter: trip.boatData.price_per_cubic_meter || 0,
        currency: trip.currency,
        ship_owner: {
          id: trip.user.id,
          name: trip.user.name || 'Unknown',
          picture: trip.user.picture || undefined,
          is_kyc_verified: kycVerifiedUserIds.has(trip.user.id),
          average_rating: averageRating,
          total_shipments: shipmentCountsByUser[trip.user.id] || 0,
        },
        status: trip.status,
      };
    });

    return {
      shipments,
      total: shipments.length,
    };
  }

  /**
   * Get boat shipment detail by ID
   */
  async getBoatShipmentDetail(
    shipmentId: string,
  ): Promise<GetBoatShipmentDetailResponseDto> {
    // Get boat transport type
    const boatTransportType = await this.prisma.transportType.findFirst({
      where: { name: this.BOAT_TRANSPORT_TYPE_NAME },
    });

    if (!boatTransportType) {
      throw new NotFoundException('Shipment not found');
    }

    const trip = await this.prisma.trip.findUnique({
      where: { id: shipmentId },
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
      throw new NotFoundException('Shipment not found');
    }

    // Check if it's a boat shipment
    if (trip.mode_of_transport?.name !== this.BOAT_TRANSPORT_TYPE_NAME) {
      throw new NotFoundException('Shipment not found');
    }

    const boatData = this.extractBoatData(trip.notes);

    // Get user ratings
    const ratings = await this.prisma.rating.findMany({
      where: { receiver_id: trip.user_id },
      select: { rating: true },
    });

    const averageRating =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : undefined;

    // Get KYC status
    const kycRecord = await this.prisma.userKYC.findFirst({
      where: {
        userId: trip.user_id,
        status: 'APPROVED',
      },
    });

    // Get total shipment count for this ship owner
    const totalShipments = await this.prisma.trip.count({
      where: {
        user_id: trip.user_id,
        mode_of_transport_id: boatTransportType.id,
      },
    });

    const durationDays = trip.arrival_date
      ? this.calculateDurationDays(trip.departure_date, trip.arrival_date)
      : 0;

    return {
      id: trip.id,
      ship_owner: {
        id: trip.user.id,
        name: trip.user.name || 'Unknown',
        picture: trip.user.picture || undefined,
        is_kyc_verified: !!kycRecord,
        average_rating: averageRating,
        total_shipments: totalShipments,
      },
      departure_port: trip.departure as any,
      arrival_port: trip.destination as any,
      departure_date: trip.departure_date,
      arrival_date: trip.arrival_date!,
      duration_days: durationDays,
      capacity_available: boatData.capacity_in_cubic_meters || 0,
      max_capacity: boatData.max_capacity_in_cubic_meters || 0,
      price_per_cubic_meter: boatData.price_per_cubic_meter || 0,
      currency: trip.currency,
      notes_for_senders: boatData.notes_for_senders || undefined,
      status: trip.status,
      created_at: trip.createdAt,
    };
  }

  /**
   * Get my boat shipments (ship owner view)
   */
  async getMyBoatShipments(
    userId: string,
    query: GetMyBoatShipmentsDto,
  ): Promise<GetMyBoatShipmentsResponseDto> {
    const boatTransportType = await this.prisma.transportType.findFirst({
      where: { name: this.BOAT_TRANSPORT_TYPE_NAME },
    });

    if (!boatTransportType) {
      return { shipments: [], total: 0 };
    }

    const where: any = {
      user_id: userId,
      mode_of_transport_id: boatTransportType.id,
    };

    const now = new Date();

    // Apply filter
    if (query.filter === MyShipmentsFilter.UPCOMING) {
      where.departure_date = { gte: now };
      where.status = TripStatus.PUBLISHED;
    } else if (query.filter === MyShipmentsFilter.PAST) {
      where.OR = [
        { departure_date: { lt: now } },
        { status: TripStatus.CANCELLED },
        { status: TripStatus.COMPLETED },
      ];
    }
    // ALL filter doesn't add any constraints

    const trips = await this.prisma.trip.findMany({
      where,
      orderBy: {
        departure_date: 'desc',
      },
    });

    const shipments = trips.map((trip) => {
      const boatData = this.extractBoatData(trip.notes);
      const durationDays = trip.arrival_date
        ? this.calculateDurationDays(trip.departure_date, trip.arrival_date)
        : 0;

      return {
        id: trip.id,
        departure_port: trip.departure as any,
        arrival_port: trip.destination as any,
        departure_date: trip.departure_date,
        arrival_date: trip.arrival_date!,
        duration_days: durationDays,
        capacity_available: boatData.capacity_in_cubic_meters || 0,
        max_capacity: boatData.max_capacity_in_cubic_meters || 0,
        price_per_cubic_meter: boatData.price_per_cubic_meter || 0,
        currency: trip.currency,
        status: trip.status,
        created_at: trip.createdAt,
      };
    });

    return {
      shipments,
      total: shipments.length,
    };
  }

  /**
   * Cancel a boat shipment
   */
  async cancelBoatShipment(
    userId: string,
    shipmentId: string,
  ): Promise<CancelBoatShipmentResponseDto> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: shipmentId },
      include: {
        mode_of_transport: true,
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
      throw new NotFoundException('Shipment not found');
    }

    // Check if it's a boat shipment
    if (trip.mode_of_transport?.name !== this.BOAT_TRANSPORT_TYPE_NAME) {
      throw new NotFoundException('Shipment not found');
    }

    // Check if user is the ship owner
    if (trip.user_id !== userId) {
      throw new ForbiddenException(
        'Only the ship owner can cancel this shipment',
      );
    }

    // Check if already cancelled
    if (trip.status === TripStatus.CANCELLED) {
      throw new BadRequestException('Shipment is already cancelled');
    }

    // Update status to cancelled
    await this.prisma.trip.update({
      where: { id: shipmentId },
      data: {
        status: TripStatus.CANCELLED,
      },
    });

    // Send push notifications to all participants in chats for this trip
    const participantIds = new Set<string>();
    for (const chat of trip.chats) {
      for (const member of chat.members) {
        if (member.user_id !== userId) {
          participantIds.add(member.user_id);
        }
      }
    }

    for (const participantId of participantIds) {
      try {
        await this.notificationService.sendPushNotificationToUser(
          participantId,
          'Shipment Cancelled',
          'A shipment you were interested in has been cancelled by the ship owner.',
          {
            type: 'shipment_cancelled',
            shipment_id: shipmentId,
          },
          'en',
        );
      } catch (error) {
        this.logger.warn(
          `Failed to send push notification to user ${participantId}: ${error.message}`,
        );
      }
    }

    return {
      message: 'Shipment cancelled successfully',
      shipment_id: shipmentId,
    };
  }

  /**
   * Create or get chat for a boat shipment
   */
  async createChatForBoat(
    userId: string,
    createDto: CreateChatForBoatDto,
  ): Promise<CreateChatForBoatResponseDto> {
    // Check if shipment exists and is a boat shipment
    const trip = await this.prisma.trip.findUnique({
      where: { id: createDto.shipment_id },
      include: {
        user: {
          select: {
            id: true,
          },
        },
        mode_of_transport: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Shipment not found');
    }

    // Check if it's a boat shipment
    if (trip.mode_of_transport?.name !== this.BOAT_TRANSPORT_TYPE_NAME) {
      throw new NotFoundException('Shipment not found');
    }

    // Check if user is trying to chat with themselves
    if (trip.user_id === userId) {
      throw new BadRequestException('Cannot chat with yourself');
    }

    // Check if chat already exists for this shipment with both users
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        trip_id: createDto.shipment_id,
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
          message: 'Chat already exists',
          chat_id: existingChat.id,
          ship_owner_id: trip.user_id,
        };
      }
    }

    // Create new chat
    const chat = await this.prisma.chat.create({
      data: {
        trip_id: createDto.shipment_id,
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
      message: 'Chat created successfully',
      chat_id: chat.id,
      ship_owner_id: trip.user_id,
    };
  }

  /**
   * Create issue report for a boat shipment (using Trip table and Report model)
   */
  async createIssueReport(
    userId: string,
    createDto: CreateIssueReportDto,
  ): Promise<CreateIssueReportResponseDto> {
    // Check if shipment exists and is a boat shipment
    const trip = await this.prisma.trip.findUnique({
      where: { id: createDto.shipment_id },
      include: {
        mode_of_transport: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Shipment not found');
    }

    // Verify this is a boat shipment
    if (trip.mode_of_transport?.name !== this.BOAT_TRANSPORT_TYPE_NAME) {
      throw new NotFoundException('Shipment not found');
    }

    // Validate report type is for boat shipments (matching Figma design)
    // Figma options: Delayed departure/arrival, Package damaged, Package lost or missing,
    // Incorrect customs declaration, Hidden fees or charges, Other
    const boatShipmentReportTypes = [
      'PACKAGE_ISSUE',      // Package damaged, Package lost or missing
      'PAYMENT_PROBLEM',    // Hidden fees or charges
      'POLICY_VIOLATION',   // Incorrect customs declaration
      'OTHER',              // Delayed departure/arrival, Other
    ];
    if (!boatShipmentReportTypes.includes(createDto.type)) {
      throw new BadRequestException(
        `Invalid report type for boat shipments. Allowed types: ${boatShipmentReportTypes.join(', ')}`,
      );
    }

    // Create report using the unified Report model
    const report = await this.prisma.report.create({
      data: {
        user_id: userId,
        reported_id: trip.user_id, // Ship owner is the reported user
        trip_id: createDto.shipment_id,
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
}

