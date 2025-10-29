import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateTripDto, CreateTripResponseDto } from './dto/create-trip.dto';
import { UpdateTripDto, UpdateTripResponseDto } from './dto/update-trip.dto';
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
import { GetTripsQueryDto, GetTripsResponseDto } from './dto/get-trips.dto';
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
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { NotificationService } from '../notification/notification.service';
import { UserRole, TripStatus } from 'generated/prisma/client';

@Injectable()
export class TripService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly notificationService: NotificationService,
  ) {}

  async createTrip(
    createTripDto: CreateTripDto,
    userId: string,
    lang?: string,
  ): Promise<CreateTripResponseDto> {
    const { mode_of_transport_id, airline_id, trip_items, ...tripData } =
      createTripDto;

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const message = await this.i18n.translate(
        'translation.trip.create.userNotFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Admins cannot create trips
    if (user.role === UserRole.ADMIN) {
      const message = await this.i18n.translate(
        'translation.trip.create.adminCannotCreate',
        {
          lang,
          defaultValue: 'Admins are not allowed to create trips',
        },
      );
      throw new ForbiddenException(message);
    }

    // Check if transport type exists (only if provided)
    if (mode_of_transport_id) {
      const transportType = await this.prisma.transportType.findUnique({
        where: { id: mode_of_transport_id },
      });

      if (!transportType) {
        const message = await this.i18n.translate(
          'translation.trip.create.transportNotFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }
    }

    // Check if airline exists
    const airline = await this.prisma.airline.findUnique({
      where: { id: airline_id },
    });

    if (!airline) {
      const message = await this.i18n.translate(
        'translation.trip.create.airlineNotFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Validate trip items - at least one item is always required
    if (!trip_items || trip_items.length === 0) {
      const message = await this.i18n.translate(
        'translation.trip.create.tripItemsRequired',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    // Validate trip items exist in database
    const tripItemIds = trip_items.map((item) => item.trip_item_id);
    const existingTripItems = await this.prisma.tripItem.findMany({
      where: { id: { in: tripItemIds } },
      select: { id: true },
    });

    if (existingTripItems.length !== tripItemIds.length) {
      const message = await this.i18n.translate(
        'translation.trip.create.tripItemNotFound',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    try {
      // Create trip with trip items in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the trip
        const trip = await prisma.trip.create({
          data: {
            user_id: userId,
            mode_of_transport_id: mode_of_transport_id || null,
            airline_id,
            pickup: tripData.pickup,
            destination: tripData.destination,
            departure: tripData.departure,
            departure_date: new Date(tripData.departure_date),
            departure_time: tripData.departure_time,
            arrival_date: tripData.arrival_date
              ? new Date(tripData.arrival_date)
              : null,
            arrival_time: tripData.arrival_time || null,
            maximum_weight_in_kg: tripData.maximum_weight_in_kg || null,
            notes: tripData.notes || null,
            meetup_flexible: tripData.meetup_flexible || false,
            currency: tripData.currency,
          },
          select: {
            id: true,
            user_id: true,
            departure_date: true,
            departure_time: true,
            arrival_date: true,
            arrival_time: true,
            currency: true,
            airline_id: true,
            createdAt: true,
          },
        });

        // Create trip items (always required)
        await prisma.tripItemsList.createMany({
          data: trip_items.map((item) => ({
            trip_id: trip.id,
            trip_item_id: item.trip_item_id,
            price: item.price,
            avalailble_kg: item.available_kg || null,
          })),
        });

        return {
          trip,
          trip_items,
        };
      });

      // Alert checking is now handled by the hourly scheduler

      const message = await this.i18n.translate(
        'translation.trip.create.success',
        {
          lang,
        },
      );

      return {
        message,
        trip: {
          ...result.trip,
          trip_items: result.trip_items,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.trip.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateTrip(
    tripId: string,
    updateTripDto: UpdateTripDto,
    userId: string,
    lang?: string,
  ): Promise<UpdateTripResponseDto> {
    // Check if trip exists
    const existingTrip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!existingTrip) {
      const message = await this.i18n.translate(
        'translation.trip.update.notFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Check if user is authorized to update this trip
    if (existingTrip.user_id !== userId) {
      const message = await this.i18n.translate(
        'translation.trip.update.unauthorized',
        {
          lang,
        },
      );
      throw new ForbiddenException(message);
    }

    try {
      const updateData: any = { ...updateTripDto };

      // Remove status from updateData - users cannot update status directly
      delete updateData.status;

      // Convert departure_date string to Date if provided
      if (updateData.departure_date) {
        updateData.departure_date = new Date(updateData.departure_date);
      }

      // Convert arrival_date string to Date if provided
      if (updateData.arrival_date) {
        updateData.arrival_date = new Date(updateData.arrival_date);
      }

      // Store departure and arrival dates in variables
      // Use new values if provided, otherwise use existing values
      let departureDate = updateData.departure_date
        ? new Date(updateData.departure_date)
        : new Date(existingTrip.departure_date);

      let arrivalDate =
        updateData.arrival_date !== undefined
          ? updateData.arrival_date
            ? new Date(updateData.arrival_date)
            : null
          : existingTrip.arrival_date
            ? new Date(existingTrip.arrival_date)
            : null;

      // Normalize dates to midnight for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      departureDate.setHours(0, 0, 0, 0);
      if (arrivalDate) {
        arrivalDate.setHours(0, 0, 0, 0);
      }

      // Validate departure_date is greater than today
      if (departureDate <= today) {
        const message = await this.i18n.translate(
          'translation.trip.update.departureDateMustBeInFuture',
          {
            lang,
            defaultValue: 'Departure date must be greater than today',
          },
        );
        throw new BadRequestException(message);
      }

      // Validate arrival_date is greater than departure_date (if arrival_date exists)
      if (arrivalDate && arrivalDate <= departureDate) {
        const message = await this.i18n.translate(
          'translation.trip.update.arrivalDateMustBeAfterDeparture',
          {
            lang,
            defaultValue: 'Arrival date must be greater than departure date',
          },
        );
        throw new BadRequestException(message);
      }

      // Handle JSON fields properly
      if (updateData.pickup !== undefined) {
        updateData.pickup = updateData.pickup || null;
      }
      if (updateData.destination !== undefined) {
        updateData.destination = updateData.destination || null;
      }

      // Check if schedule-related fields have changed
      let scheduleChanged = false;

      // Check departure_date
      if (updateData.departure_date) {
        const existingDate = new Date(existingTrip.departure_date);
        const newDate = new Date(updateData.departure_date);
        if (existingDate.getTime() !== newDate.getTime()) {
          scheduleChanged = true;
        }
      }

      // Check departure_time
      if (
        updateData.departure_time !== undefined &&
        updateData.departure_time !== existingTrip.departure_time
      ) {
        scheduleChanged = true;
      }

      // Check arrival_date
      if (updateData.arrival_date !== undefined) {
        const existingArrivalDate = existingTrip.arrival_date
          ? new Date(existingTrip.arrival_date).getTime()
          : null;
        const newArrivalDate = updateData.arrival_date
          ? new Date(updateData.arrival_date).getTime()
          : null;

        if (existingArrivalDate !== newArrivalDate) {
          scheduleChanged = true;
        }
      }

      // Check arrival_time
      if (
        updateData.arrival_time !== undefined &&
        updateData.arrival_time !== existingTrip.arrival_time
      ) {
        scheduleChanged = true;
      }

      // If any schedule field changed, change status to RESCHEDULED
      if (scheduleChanged) {
        updateData.status = 'RESCHEDULED';
      }

      const trip = await this.prisma.trip.update({
        where: { id: tripId },
        data: updateData,
        select: {
          id: true,
          user_id: true,
          departure_date: true,
          departure_time: true,
          arrival_date: true,
          arrival_time: true,
          status: true,
          fully_booked: true,
          updatedAt: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.trip.update.success',
        {
          lang,
        },
      );

      return {
        message,
        trip,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.trip.update.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Update trip status based on departure and arrival dates
  async updateTripStatusByDates(tripId: string): Promise<void> {
    // Fetch the trip
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        departure_date: true,
        arrival_date: true,
        status: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const departureDate = new Date(trip.departure_date);
    departureDate.setHours(0, 0, 0, 0);

    const arrivalDate = trip.arrival_date ? new Date(trip.arrival_date) : null;
    if (arrivalDate) {
      arrivalDate.setHours(0, 0, 0, 0);
    }

    let newStatus: TripStatus | null = null;

    // Check if trip should be COMPLETED (arrival date has passed)
    if (arrivalDate && arrivalDate < today) {
      newStatus = TripStatus.COMPLETED;
    }
    // Check if trip should be INPROGRESS (departed but not yet arrived)
    else if (departureDate <= today && (!arrivalDate || arrivalDate >= today)) {
      newStatus = TripStatus.INPROGRESS;
    }

    // Update status if it needs to change
    if (newStatus && trip.status !== newStatus) {
      await this.prisma.trip.update({
        where: { id: tripId },
        data: { status: newStatus },
      });
    }
  }

  // Get all trips created by user with status filter
  async getUserTrips(
    userId: string,
    query: GetUserTripsQueryDto,
    lang?: string,
  ): Promise<GetUserTripsResponseDto> {
    try {
      const { status, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {
        user_id: userId,
      };

      // Only filter by status if provided and not "ALL"
      if (status && status !== 'ALL') {
        whereClause.status = status;
      }

      // Fetch trips with relations
      // Note: Trip statuses are automatically updated by the scheduler every hour
      const [trips, total] = await Promise.all([
        this.prisma.trip.findMany({
          where: whereClause,
          select: {
            id: true,
            departure: true,
            destination: true,
            status: true,
            departure_date: true,
            departure_time: true,
            arrival_date: true,
            arrival_time: true,
            createdAt: true,
            airline: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            ratings: {
              select: {
                id: true,
                rating: true,
                comment: true,
                giver_id: true,
              },
            },
            transactions: {
              where: {
                status: {
                  in: ['ONHOLD', 'COMPLETED', 'SUCCESS'],
                },
              },
              select: {
                amount_paid: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.trip.count({ where: whereClause }),
      ]);

      // Process trips to calculate average rating and total payment
      const processedTrips = trips.map((trip) => {
        // Calculate average rating
        const ratingsSum = trip.ratings.reduce(
          (sum, rating) => sum + rating.rating,
          0,
        );
        const average_rating =
          trip.ratings.length > 0 ? ratingsSum / trip.ratings.length : 0;

        // Calculate total payment
        const total_payment = trip.transactions.reduce(
          (sum, transaction) => sum + Number(transaction.amount_paid),
          0,
        );

        return {
          id: trip.id,
          departure: trip.departure,
          destination: trip.destination,
          status: trip.status,
          departure_date: trip.departure_date,
          departure_time: trip.departure_time,
          arrival_date: trip.arrival_date,
          arrival_time: trip.arrival_time,
          airline: trip.airline,
          ratings: trip.ratings,
          average_rating: Number(average_rating.toFixed(2)),
          total_payment: Number(total_payment.toFixed(2)),
          createdAt: trip.createdAt,
        };
      });

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.trip.getUserTrips.success',
        {
          lang,
          defaultValue: 'User trips retrieved successfully',
        },
      );

      return {
        message,
        trips: processedTrips,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting user trips:', error);
      const message = await this.i18n.translate(
        'translation.trip.getUserTrips.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve user trips',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Get user trip detail by ID
  async getUserTripDetail(
    userId: string,
    tripId: string,
    lang?: string,
  ): Promise<GetUserTripDetailResponseDto> {
    try {
      // Fetch the trip with all relations
      const trip: any = await this.prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          user_id: true,
          pickup: true,
          departure: true,
          destination: true,
          delivery: true,
          departure_date: true,
          departure_time: true,
          arrival_date: true,
          arrival_time: true,
          currency: true,
          maximum_weight_in_kg: true,
          notes: true,
          meetup_flexible: true,
          status: true,
          fully_booked: true,
          createdAt: true,
          updatedAt: true,
          airline: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          mode_of_transport: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          trip_items: {
            select: {
              trip_item_id: true,
              price: true,
              avalailble_kg: true,
              trip_item: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  image: {
                    select: {
                      id: true,
                      url: true,
                      alt_text: true,
                    },
                  },
                },
              },
            },
          },
          requests: {
            select: {
              id: true,
              user_id: true,
              status: true,
              cost: true,
              message: true,
              created_at: true,
              updated_at: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  picture: true,
                },
              },
              request_items: {
                select: {
                  trip_item_id: true,
                  quantity: true,
                  special_notes: true,
                  trip_item: {
                    select: {
                      id: true,
                      name: true,
                      description: true,
                      image: {
                        select: {
                          id: true,
                          url: true,
                          alt_text: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          transactions: {
            where: {
              status: {
                in: ['SUCCESS', 'COMPLETED', 'ONHOLD'],
              },
            },
            select: {
              amount_paid: true,
              status: true,
            },
          },
        },
      });

      if (!trip) {
        const message = await this.i18n.translate(
          'translation.trip.getUserTripDetail.notFound',
          {
            lang,
            defaultValue: 'Trip not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Check if the trip belongs to the user
      if (trip.user_id !== userId) {
        const message = await this.i18n.translate(
          'translation.trip.getUserTripDetail.unauthorized',
          {
            lang,
            defaultValue: 'You are not authorized to view this trip',
          },
        );
        throw new ForbiddenException(message);
      }

      // Calculate available_earnings (SUCCESS + COMPLETED)
      const available_earnings = trip.transactions
        .filter((t) => t.status === 'SUCCESS' || t.status === 'COMPLETED')
        .reduce((sum, t) => sum + Number(t.amount_paid), 0);

      // Calculate hold_earnings (ONHOLD)
      const hold_earnings = trip.transactions
        .filter((t) => t.status === 'ONHOLD')
        .reduce((sum, t) => sum + Number(t.amount_paid), 0);

      // Transform trip items
      const tripItems = trip.trip_items.map((item) => ({
        trip_item_id: item.trip_item_id,
        price: Number(item.price),
        available_kg: item.avalailble_kg ? Number(item.avalailble_kg) : null,
        trip_item: item.trip_item,
      }));

      // Transform requests
      const requests = trip.requests.map((request) => ({
        id: request.id,
        user_id: request.user_id,
        status: request.status,
        cost: request.cost ? Number(request.cost) : null,
        message: request.message,
        created_at: request.created_at,
        updated_at: request.updated_at,
        user: request.user,
        request_items: request.request_items.map((item) => ({
          trip_item_id: item.trip_item_id,
          quantity: item.quantity,
          special_notes: item.special_notes,
          trip_item: item.trip_item,
        })),
      }));

      // Calculate total_kg from trip items
      const total_kg = trip.trip_items.reduce((sum, item) => {
        return sum + (item.avalailble_kg ? Number(item.avalailble_kg) : 0);
      }, 0);

      // Calculate booked_kg from all active request items
      const booked_kg = trip.requests
        .filter(
          (request) =>
            ![
              'CANCELLED',
              'DECLINED',
              'REFUNDED',
              'PENDING',
              'ACCEPTED',
            ].includes(request.status),
        )
        .reduce((sum, request) => {
          const requestKg = request.request_items.reduce((reqSum, item) => {
            return reqSum + item.quantity;
          }, 0);
          return sum + requestKg;
        }, 0);

      // Calculate available_kg
      const available_kg = total_kg - booked_kg;

      const message = await this.i18n.translate(
        'translation.trip.getUserTripDetail.success',
        {
          lang,
          defaultValue: 'Trip details retrieved successfully',
        },
      );

      return {
        message,
        trip: {
          id: trip.id,
          user_id: trip.user_id,
          pickup: trip.pickup,
          departure: trip.departure,
          destination: trip.destination,
          delivery: trip.delivery,
          departure_date: trip.departure_date,
          departure_time: trip.departure_time,
          arrival_date: trip.arrival_date,
          arrival_time: trip.arrival_time,
          currency: trip.currency,
          maximum_weight_in_kg: trip.maximum_weight_in_kg
            ? Number(trip.maximum_weight_in_kg)
            : null,
          notes: trip.notes,
          meetup_flexible: trip.meetup_flexible,
          status: trip.status,
          fully_booked: trip.fully_booked,
          createdAt: trip.createdAt,
          updatedAt: trip.updatedAt,
          airline: trip.airline,
          mode_of_transport: trip.mode_of_transport,
          trip_items: tripItems,
          requests,
          available_earnings: Number(available_earnings.toFixed(2)),
          hold_earnings: Number(hold_earnings.toFixed(2)),
          booked_kg: Number(booked_kg.toFixed(2)),
          available_kg: Number(available_kg.toFixed(2)),
          total_kg: Number(total_kg.toFixed(2)),
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      console.error('Error getting user trip detail:', error);
      const message = await this.i18n.translate(
        'translation.trip.getUserTripDetail.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve trip details',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // TransportType methods
  async createTransportType(
    createTransportTypeDto: CreateTransportTypeDto,
    lang?: string,
  ): Promise<CreateTransportTypeResponseDto> {
    // Check if transport type with this name already exists
    const existingTransportType = await this.prisma.transportType.findUnique({
      where: { name: createTransportTypeDto.name },
    });

    if (existingTransportType) {
      const message = await this.i18n.translate(
        'translation.transportType.create.nameExists',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    try {
      const transportType = await this.prisma.transportType.create({
        data: createTransportTypeDto,
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.transportType.create.success',
        {
          lang,
        },
      );

      return {
        message,
        transportType,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.transportType.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateTransportType(
    transportTypeId: string,
    updateTransportTypeDto: UpdateTransportTypeDto,
    lang?: string,
  ): Promise<UpdateTransportTypeResponseDto> {
    // Check if transport type exists
    const existingTransportType = await this.prisma.transportType.findUnique({
      where: { id: transportTypeId },
    });

    if (!existingTransportType) {
      const message = await this.i18n.translate(
        'translation.transportType.update.notFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Check if name is being updated and if it conflicts with existing name
    if (
      updateTransportTypeDto.name &&
      updateTransportTypeDto.name !== existingTransportType.name
    ) {
      const conflictingTransportType =
        await this.prisma.transportType.findUnique({
          where: { name: updateTransportTypeDto.name },
        });

      if (conflictingTransportType) {
        const message = await this.i18n.translate(
          'translation.transportType.update.nameExists',
          {
            lang,
          },
        );
        throw new ConflictException(message);
      }
    }

    try {
      const transportType = await this.prisma.transportType.update({
        where: { id: transportTypeId },
        data: updateTransportTypeDto,
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.transportType.update.success',
        {
          lang,
        },
      );

      return {
        message,
        transportType,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.transportType.update.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // TripItem methods
  async createTripItem(
    createTripItemDto: CreateTripItemDto,
    lang?: string,
  ): Promise<CreateTripItemResponseDto> {
    // Check if trip item with this name already exists
    const existingTripItem = await this.prisma.tripItem.findUnique({
      where: { name: createTripItemDto.name },
    });

    if (existingTripItem) {
      const message = await this.i18n.translate(
        'translation.tripItem.create.nameExists',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    try {
      const { image_id, ...tripItemData } = createTripItemDto;

      const tripItem = await this.prisma.tripItem.create({
        data: {
          ...tripItemData,
          image_id: image_id || null,
        },
        select: {
          id: true,
          name: true,
          description: true,
          image: {
            select: {
              id: true,
              url: true,
              alt_text: true,
            },
          },
        },
      });

      const message = await this.i18n.translate(
        'translation.tripItem.create.success',
        {
          lang,
        },
      );

      return {
        message,
        tripItem,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.tripItem.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateTripItem(
    tripItemId: string,
    updateTripItemDto: UpdateTripItemDto,
    lang?: string,
  ): Promise<UpdateTripItemResponseDto> {
    // Check if trip item exists
    const existingTripItem = await this.prisma.tripItem.findUnique({
      where: { id: tripItemId },
    });

    if (!existingTripItem) {
      const message = await this.i18n.translate(
        'translation.tripItem.update.notFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Check if name is being updated and if it conflicts with existing name
    if (
      updateTripItemDto.name &&
      updateTripItemDto.name !== existingTripItem.name
    ) {
      const conflictingTripItem = await this.prisma.tripItem.findUnique({
        where: { name: updateTripItemDto.name },
      });

      if (conflictingTripItem) {
        const message = await this.i18n.translate(
          'translation.tripItem.update.nameExists',
          {
            lang,
          },
        );
        throw new ConflictException(message);
      }
    }

    try {
      const { image_id, ...tripItemData } = updateTripItemDto;

      const tripItem = await this.prisma.tripItem.update({
        where: { id: tripItemId },
        data: {
          ...tripItemData,
          image_id: image_id !== undefined ? image_id : undefined,
        },
        select: {
          id: true,
          name: true,
          description: true,
          image: {
            select: {
              id: true,
              url: true,
              alt_text: true,
            },
          },
        },
      });

      const message = await this.i18n.translate(
        'translation.tripItem.update.success',
        {
          lang,
        },
      );

      return {
        message,
        tripItem,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.tripItem.update.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // GET methods for TransportType
  async getAllTransportTypes(
    query: GetTransportTypesQueryDto,
    lang?: string,
  ): Promise<GetTransportTypesResponseDto> {
    try {
      const { page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const [transportTypes, total] = await Promise.all([
        this.prisma.transportType.findMany({
          select: {
            id: true,
            name: true,
            description: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.transportType.count(),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      const message = await this.i18n.translate(
        'translation.transportType.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        transportTypes,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.transportType.getAll.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getTransportTypeById(transportTypeId: string, lang?: string) {
    try {
      const transportType = await this.prisma.transportType.findUnique({
        where: { id: transportTypeId },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      if (!transportType) {
        const message = await this.i18n.translate(
          'translation.transportType.getById.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      const message = await this.i18n.translate(
        'translation.transportType.getById.success',
        {
          lang,
        },
      );

      return {
        message,
        transportType,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.transportType.getById.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // GET methods for TripItem
  async getAllTripItems(
    query: GetTripItemsQueryDto,
    lang?: string,
  ): Promise<GetTripItemsResponseDto> {
    try {
      const { page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const [tripItems, total] = await Promise.all([
        this.prisma.tripItem.findMany({
          select: {
            id: true,
            name: true,
            description: true,
            image: {
              select: {
                id: true,
                url: true,
                alt_text: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.tripItem.count(),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      const message = await this.i18n.translate(
        'translation.tripItem.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        tripItems,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.tripItem.getAll.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getTripItemById(tripItemId: string, lang?: string) {
    try {
      const tripItem = await this.prisma.tripItem.findUnique({
        where: { id: tripItemId },
        select: {
          id: true,
          name: true,
          description: true,
          image: {
            select: {
              id: true,
              url: true,
              alt_text: true,
            },
          },
        },
      });

      if (!tripItem) {
        const message = await this.i18n.translate(
          'translation.tripItem.getById.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      const message = await this.i18n.translate(
        'translation.tripItem.getById.success',
        {
          lang,
        },
      );

      return {
        message,
        tripItem,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.tripItem.getById.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Get trips with pagination and country filtering
  async getTrips(
    query: GetTripsQueryDto,
    lang?: string,
  ): Promise<GetTripsResponseDto> {
    try {
      const {
        country,
        departure,
        destination,
        filter = 'all',
        page = 1,
        limit = 10,
        trip_items_ids,
        departure_date_from,
        departure_date_to,
      } = query;
      const skip = (page - 1) * limit;

      // Base where clause - exclude DRAFT, COMPLETED, and CANCELLED trips
      const baseWhereClause: any = {
        status: {
          notIn: [TripStatus.DRAFT, TripStatus.COMPLETED, TripStatus.CANCELLED],
        },
      };

      // Add departure date filter based on filter parameter
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Handle custom date range if provided
      if (departure_date_from || departure_date_to) {
        const dateFilter: any = {};

        if (departure_date_from) {
          const fromDate = new Date(departure_date_from);
          dateFilter.gte = fromDate;
        }

        if (departure_date_to) {
          const toDate = new Date(departure_date_to);
          dateFilter.lte = toDate;
        }

        baseWhereClause.departure_date = dateFilter;
      } else if (filter === 'today') {
        // Show only trips departing today
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        baseWhereClause.departure_date = {
          gte: today,
          lt: tomorrow,
        };
      } else if (filter === 'tomorrow') {
        // Show only trips departing tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        baseWhereClause.departure_date = {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        };
      } else if (filter === 'week') {
        // Show only trips departing this week (from today to end of week - Sunday)
        const endOfWeek = new Date(today);
        const dayOfWeek = today.getDay();
        const daysUntilSunday = 7 - dayOfWeek;
        endOfWeek.setDate(today.getDate() + daysUntilSunday);
        endOfWeek.setHours(23, 59, 59, 999);

        baseWhereClause.departure_date = {
          gte: today,
          lte: endOfWeek,
        };
      } else {
        // filter === 'all': Show all future trips
        baseWhereClause.departure_date = {
          gte: today, // Only show trips with departure date >= today
        };
      }

      // Add search filters if departure or destination is provided
      if (
        (departure && departure.trim() !== '') ||
        (destination && destination.trim() !== '')
      ) {
        try {
          const searchFilters = [];

          // Search in departure location if departure parameter is provided
          if (departure && departure.trim() !== '') {
            searchFilters.push({
              departure: {
                path: ['country'],
                string_contains: departure,
                mode: 'insensitive',
              },
            });

            searchFilters.push({
              departure: {
                path: ['region'],
                string_contains: departure,
                mode: 'insensitive',
              },
            });

            searchFilters.push({
              departure: {
                path: ['address'],
                string_contains: departure,
                mode: 'insensitive',
              },
            });
          }

          // Search in destination location if destination parameter is provided
          if (destination && destination.trim() !== '') {
            searchFilters.push({
              destination: {
                path: ['country'],
                string_contains: destination,
                mode: 'insensitive',
              },
            });

            searchFilters.push({
              destination: {
                path: ['region'],
                string_contains: destination,
                mode: 'insensitive',
              },
            });

            searchFilters.push({
              destination: {
                path: ['address'],
                string_contains: destination,
                mode: 'insensitive',
              },
            });
          }

          // Add OR condition for all search filters
          baseWhereClause.OR = searchFilters;
        } catch (error) {
          // If search filter creation fails, log error but continue without search
          console.error('Error creating search filters:', error);
        }
      }

      // Add trip items filtering if trip_items_ids is provided
      if (trip_items_ids && trip_items_ids.trim() !== '') {
        try {
          // Parse comma-separated trip item IDs
          const tripItemIds = trip_items_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id !== '');

          if (tripItemIds.length > 0) {
            // Filter trips that have at least one of the specified trip items
            baseWhereClause.trip_items = {
              some: {
                trip_item_id: {
                  in: tripItemIds,
                },
              },
            };
          }
        } catch (error) {
          // If trip items filter creation fails, log error but continue without filter
          console.error('Error creating trip items filter:', error);
        }
      }

      // Get trips with normal Prisma pagination
      const [allTrips, total] = await Promise.all([
        this.prisma.trip.findMany({
          where: baseWhereClause,
          select: {
            id: true,
            departure_date: true,
            departure_time: true,
            arrival_date: true,
            arrival_time: true,
            currency: true,
            departure: true,
            destination: true,
            createdAt: true,
            mode_of_transport: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
            trip_items: {
              select: {
                trip_item_id: true,
                price: true,
                avalailble_kg: true,
                trip_item: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    image: {
                      select: {
                        id: true,
                        url: true,
                        alt_text: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.trip.count({ where: baseWhereClause }),
      ]);

      let trips: any[] = allTrips;

      // If country is specified and no departure/destination search, reorder to put matching trips at the top
      if (
        country &&
        (!departure || departure.trim() === '') &&
        (!destination || destination.trim() === '')
      ) {
        const countryTrips = allTrips.filter((trip) => {
          const destinationCountry =
            trip.destination &&
            typeof trip.destination === 'object' &&
            'country_code' in trip.destination
              ? (trip.destination as any).country_code
              : null;

          return destinationCountry?.toLowerCase() === country.toLowerCase();
        });

        const otherTrips = allTrips.filter((trip) => {
          const destinationCountry =
            trip.destination &&
            typeof trip.destination === 'object' &&
            'country_code' in trip.destination
              ? (trip.destination as any).country_code
              : null;

          return destinationCountry?.toLowerCase() !== country.toLowerCase();
        });

        // Put country-specific trips at the top, then other trips
        trips = [...countryTrips, ...otherTrips];
      }

      // Transform trips to summary format
      const tripSummaries = trips.map((trip) => ({
        id: trip.id,
        user: trip.user
          ? {
              id: trip.user.id,
              email: trip.user.email,
              role: trip.user.role,
            }
          : null,
        departure_date: trip.departure_date,
        departure_time: trip.departure_time,
        arrival_date: trip.arrival_date,
        arrival_time: trip.arrival_time,
        currency: trip.currency,
        mode_of_transport: trip.mode_of_transport
          ? {
              id: trip.mode_of_transport.id,
              name: trip.mode_of_transport.name,
              description: trip.mode_of_transport.description,
            }
          : null,
        departure: trip.departure,
        destination: trip.destination,
        from: trip.departure, // Alias for departure
        to: trip.destination, // Alias for destination
        trip_items: trip.trip_items.map((item) => ({
          trip_item_id: item.trip_item_id,
          price: Number(item.price),
          available_kg: item.avalailble_kg ? Number(item.avalailble_kg) : null,
          trip_item: item.trip_item,
        })),
        createdAt: trip.createdAt,
      }));

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.trip.getAll.success',
        { lang },
      );
      return {
        message,
        trips: tripSummaries,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting trips:', error);
      const message = await this.i18n.translate(
        'translation.trip.getAll.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Get trip by ID with full details
  async getTripById(
    tripId: string,
    lang?: string,
  ): Promise<GetTripByIdResponseDto> {
    try {
      const trip = await this.prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          user_id: true,
          pickup: true,
          departure: true,
          destination: true,
          delivery: true,
          departure_date: true,
          departure_time: true,
          arrival_date: true,
          arrival_time: true,
          currency: true,
          mode_of_transport_id: true,
          airline_id: true,
          maximum_weight_in_kg: true,
          notes: true,
          meetup_flexible: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              picture: true,
              role: true,
            },
          },
          mode_of_transport: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          airline: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          trip_items: {
            select: {
              trip_item_id: true,
              price: true,
              avalailble_kg: true,
              trip_item: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  image: {
                    select: {
                      id: true,
                      url: true,
                      alt_text: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!trip) {
        const message = await this.i18n.translate(
          'translation.trip.getById.notFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Transform trip items
      const tripItems = trip.trip_items.map((item) => ({
        trip_item_id: item.trip_item_id,
        price: Number(item.price),
        available_kg: item.avalailble_kg ? Number(item.avalailble_kg) : null,
        trip_item: item.trip_item,
      }));

      // Calculate total_kg from trip items
      const total_kg = trip.trip_items.reduce((sum, item) => {
        return sum + (item.avalailble_kg ? Number(item.avalailble_kg) : 0);
      }, 0);

      // Get all requests for this trip and calculate booked_kg
      const requests = await this.prisma.tripRequest.findMany({
        where: {
          trip_id: tripId,
          status: {
            notIn: ['CANCELLED', 'DECLINED', 'REFUNDED', 'PENDING'],
          },
        },
        include: {
          request_items: {
            select: {
              quantity: true,
            },
          },
        },
      });

      // Calculate booked_kg from all request items
      const booked_kg = requests.reduce((sum, request) => {
        const requestKg = request.request_items.reduce((reqSum, item) => {
          return reqSum + item.quantity;
        }, 0);
        return sum + requestKg;
      }, 0);

      // Calculate available_kg
      const available_kg = total_kg - booked_kg;

      const message = await this.i18n.translate(
        'translation.trip.getById.success',
        { lang },
      );
      return {
        message,
        trip: {
          id: trip.id,
          user_id: trip.user_id,
          user: trip.user,
          pickup: trip.pickup,
          departure: trip.departure,
          destination: trip.destination,
          delivery: trip.delivery,
          departure_date: trip.departure_date,
          departure_time: trip.departure_time,
          arrival_date: trip.arrival_date,
          arrival_time: trip.arrival_time,
          currency: trip.currency,
          mode_of_transport_id: trip.mode_of_transport_id,
          airline_id: trip.airline_id,
          maximum_weight_in_kg: trip.maximum_weight_in_kg
            ? Number(trip.maximum_weight_in_kg)
            : null,
          notes: trip.notes,
          meetup_flexible: trip.meetup_flexible,
          status: trip.status,
          createdAt: trip.createdAt,
          updatedAt: trip.updatedAt,
          mode_of_transport: trip.mode_of_transport,
          airline: trip.airline,
          trip_items: tripItems,
          booked_kg: Number(booked_kg.toFixed(2)),
          available_kg: Number(available_kg.toFixed(2)),
          total_kg: Number(total_kg.toFixed(2)),
        },
      };
    } catch (error) {
      console.error('Error getting trip item by id:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.trip.getById.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Airline methods
  async createAirline(
    createAirlineDto: CreateAirlineDto,
    lang?: string,
  ): Promise<CreateAirlineResponseDto> {
    // Check if airline with this name already exists
    const existingAirline = await this.prisma.airline.findUnique({
      where: { name: createAirlineDto.name },
    });

    if (existingAirline) {
      const message = await this.i18n.translate(
        'translation.airline.create.nameExists',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    try {
      const airline = await this.prisma.airline.create({
        data: createAirlineDto,
        select: {
          id: true,
          name: true,
          description: true,
          created_at: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.airline.create.success',
        {
          lang,
        },
      );

      return {
        message,
        airline,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.airline.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getAllAirlines(
    query: GetAirlinesQueryDto,
    lang?: string,
  ): Promise<GetAirlinesResponseDto> {
    try {
      const { page = 1, limit = 10, searchKey } = query;
      const skip = (page - 1) * limit;

      // Build where clause for search
      const whereClause: any = {};
      if (searchKey && searchKey.trim() !== '') {
        whereClause.name = {
          contains: searchKey,
          mode: 'insensitive',
        };
      }

      const [airlines, total] = await Promise.all([
        this.prisma.airline.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            description: true,
            created_at: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.airline.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      const message = await this.i18n.translate(
        'translation.airline.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        airlines,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.airline.getAll.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Alert methods
  async createAlert(
    userId: string,
    createAlertDto: CreateAlertDto,
    lang: string,
  ): Promise<CreateAlertResponseDto> {
    try {
      // Check for existing alert with the same data
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          user_id: userId,
          depature: createAlertDto.depature,
          destination: createAlertDto.destination,
          form_date: createAlertDto.form_date
            ? new Date(createAlertDto.form_date)
            : null,
          to_date: createAlertDto.to_date
            ? new Date(createAlertDto.to_date)
            : null,
        },
      });

      if (existingAlert) {
        const message = await this.i18n.translate(
          'translation.alert.create.duplicate',
          {
            lang,
            defaultValue: 'An alert with the same details already exists',
          },
        );
        throw new ConflictException(message);
      }

      const alert = await this.prisma.alert.create({
        data: {
          user_id: userId,
          depature: createAlertDto.depature,
          destination: createAlertDto.destination,
          notificaction: createAlertDto.notificaction ?? true,
          form_date: createAlertDto.form_date
            ? new Date(createAlertDto.form_date)
            : null,
          to_date: createAlertDto.to_date
            ? new Date(createAlertDto.to_date)
            : null,
        },
      });

      const message = await this.i18n.translate(
        'translation.alert.create.success',
        {
          lang,
        },
      );

      return {
        message,
        alert,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.alert.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateAlert(
    alertId: string,
    userId: string,
    updateAlertDto: UpdateAlertDto,
    lang: string,
  ): Promise<UpdateAlertResponseDto> {
    try {
      // Check if alert exists and belongs to user
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          id: alertId,
          user_id: userId,
        },
      });

      if (!existingAlert) {
        const message = await this.i18n.translate(
          'translation.alert.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      const updateData: any = {};
      if (updateAlertDto.depature !== undefined) {
        updateData.depature = updateAlertDto.depature;
      }
      if (updateAlertDto.destination !== undefined) {
        updateData.destination = updateAlertDto.destination;
      }
      if (updateAlertDto.notificaction !== undefined) {
        updateData.notificaction = updateAlertDto.notificaction;
      }
      if (updateAlertDto.form_date !== undefined) {
        updateData.form_date = updateAlertDto.form_date
          ? new Date(updateAlertDto.form_date)
          : null;
      }
      if (updateAlertDto.to_date !== undefined) {
        updateData.to_date = updateAlertDto.to_date
          ? new Date(updateAlertDto.to_date)
          : null;
      }

      const alert = await this.prisma.alert.update({
        where: {
          id: alertId,
        },
        data: updateData,
      });

      const message = await this.i18n.translate(
        'translation.alert.update.success',
        {
          lang,
        },
      );

      return {
        message,
        alert,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.alert.update.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async deleteAlert(
    alertId: string,
    userId: string,
    lang: string,
  ): Promise<DeleteAlertResponseDto> {
    try {
      // Check if alert exists and belongs to user
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          id: alertId,
          user_id: userId,
        },
      });

      if (!existingAlert) {
        const message = await this.i18n.translate(
          'translation.alert.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      await this.prisma.alert.delete({
        where: {
          id: alertId,
        },
      });

      const message = await this.i18n.translate(
        'translation.alert.delete.success',
        {
          lang,
        },
      );

      return {
        message,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.alert.delete.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getUserAlerts(
    userId: string,
    query: GetAlertsQueryDto,
    lang: string,
  ): Promise<GetAlertsResponseDto> {
    try {
      const { page = 1, limit = 10, searchKey } = query;
      const skip = (page - 1) * limit;

      // Build where clause with search functionality
      const whereClause: any = {
        user_id: userId,
      };

      if (searchKey) {
        whereClause.OR = [
          {
            depature: {
              contains: searchKey,
              mode: 'insensitive',
            },
          },
          {
            destination: {
              contains: searchKey,
              mode: 'insensitive',
            },
          },
        ];
      }

      const [alerts, total] = await Promise.all([
        this.prisma.alert.findMany({
          where: whereClause,
          select: {
            id: true,
            user_id: true,
            depature: true,
            destination: true,
            notificaction: true,
            form_date: true,
            to_date: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.alert.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.alert.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        alerts,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.alert.getAll.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }
}
