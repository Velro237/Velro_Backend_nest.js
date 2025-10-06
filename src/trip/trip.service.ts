import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  ConflictException,
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
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { NotificationService } from '../notification/notification.service';

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

      // Check alerts and create notifications asynchronously (don't wait for completion)
      this.checkAlertsAndCreateNotifications(result.trip.id).catch((error) => {
        console.error('Error checking alerts for trip:', error);
      });

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

      // Convert departure_date string to Date if provided
      if (updateData.departure_date) {
        updateData.departure_date = new Date(updateData.departure_date);
      }

      // Handle JSON fields properly
      if (updateData.pickup !== undefined) {
        updateData.pickup = updateData.pickup || null;
      }
      if (updateData.destination !== undefined) {
        updateData.destination = updateData.destination || null;
      }

      const trip = await this.prisma.trip.update({
        where: { id: tripId },
        data: updateData,
        select: {
          id: true,
          user_id: true,
          departure_date: true,
          departure_time: true,
          price_per_kg: true,
          status: true,
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
      const { country, searchKey, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      // Base where clause for published trips
      const baseWhereClause: any = {
        status: 'PUBLISHED' as const, // Only show published trips
        departure_date: {
          gte: new Date(), // Only show trips with departure date >= today
        },
      };

      // Add search filters if searchKey is provided
      if (searchKey && searchKey.trim() !== '') {
        try {
          const searchFilters = [];

          // Check if searchKey is a valid date
          const searchDate = new Date(searchKey);
          const isValidDate = !isNaN(searchDate.getTime());

          // Only add date filters if searchKey is a valid date
          if (isValidDate) {
            // Search in departure_date (convert to string for partial matching)
            searchFilters.push({
              departure_date: {
                gte: searchDate, // Greater than or equal to search date
              },
            });

            // Search in arrival_date (convert to string for partial matching)
            searchFilters.push({
              arrival_date: {
                gte: searchDate, // Greater than or equal to search date
              },
            });
          }

          // Search in delivery JSON fields (country name, code, address) - case insensitive
          searchFilters.push({
            delivery: {
              path: ['country_name'],
              string_contains: searchKey,
              mode: 'insensitive',
            },
          });

          searchFilters.push({
            delivery: {
              path: ['country_code'],
              string_contains: searchKey,
              mode: 'insensitive',
            },
          });

          searchFilters.push({
            delivery: {
              path: ['address'],
              string_contains: searchKey,
              mode: 'insensitive',
            },
          });

          // Search in pickup JSON fields (country name, code, address) - case insensitive
          searchFilters.push({
            pickup: {
              path: ['country_name'],
              string_contains: searchKey,
              mode: 'insensitive',
            },
          });

          searchFilters.push({
            pickup: {
              path: ['country_code'],
              string_contains: searchKey,
              mode: 'insensitive',
            },
          });

          searchFilters.push({
            pickup: {
              path: ['address'],
              string_contains: searchKey,
              mode: 'insensitive',
            },
          });

          // Search in destination JSON fields (country name, code, address) - case insensitive
          searchFilters.push({
            destination: {
              path: ['country_name'],
              string_contains: searchKey,
              mode: 'insensitive',
            },
          });

          searchFilters.push({
            destination: {
              path: ['country_code'],
              string_contains: searchKey,
              mode: 'insensitive',
            },
          });

          searchFilters.push({
            destination: {
              path: ['address'],
              string_contains: searchKey,
              mode: 'insensitive',
            },
          });

          // Add OR condition for all search filters
          baseWhereClause.OR = searchFilters;
        } catch (error) {
          // If search filter creation fails, log error but continue without search
          console.error('Error creating search filters:', error);
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
            pickup: true,
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
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.trip.count({ where: baseWhereClause }),
      ]);

      let trips: any[] = allTrips;

      // If country is specified and no search key, reorder to put matching trips at the top
      if (country && (!searchKey || searchKey.trim() === '')) {
        const countryTrips = allTrips.filter((trip) => {
          const pickupCountry =
            trip.pickup &&
            typeof trip.pickup === 'object' &&
            'country_code' in trip.pickup
              ? (trip.pickup as any).country_code
              : null;
          const destinationCountry =
            trip.destination &&
            typeof trip.destination === 'object' &&
            'country_code' in trip.destination
              ? (trip.destination as any).country_code
              : null;

          return (
            pickupCountry?.toLowerCase() === country.toLowerCase() ||
            destinationCountry?.toLowerCase() === country.toLowerCase()
          );
        });

        const otherTrips = allTrips.filter((trip) => {
          const pickupCountry =
            trip.pickup &&
            typeof trip.pickup === 'object' &&
            'country_code' in trip.pickup
              ? (trip.pickup as any).country_code
              : null;
          const destinationCountry =
            trip.destination &&
            typeof trip.destination === 'object' &&
            'country_code' in trip.destination
              ? (trip.destination as any).country_code
              : null;

          return (
            pickupCountry?.toLowerCase() !== country.toLowerCase() &&
            destinationCountry?.toLowerCase() !== country.toLowerCase()
          );
        });

        // Put country-specific trips at the top, then other trips
        trips = [...countryTrips, ...otherTrips];
      }

      // Transform trips to summary format
      const tripSummaries = trips.map((trip) => ({
        id: trip.id,
        user: {
          id: trip.user.id,
          email: trip.user.email,
          role: trip.user.role,
        },
        departure_date: trip.departure_date,
        departure_time: trip.departure_time,
        arrival_date: trip.arrival_date,
        arrival_time: trip.arrival_time,
        mode_of_transport: {
          id: trip.mode_of_transport.id,
          name: trip.mode_of_transport.name,
          description: trip.mode_of_transport.description,
        },
        pickup: trip.pickup,
        destination: trip.destination,
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
        include: {
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

      const message = await this.i18n.translate(
        'translation.trip.getById.success',
        { lang },
      );
      return {
        message,
        trip: {
          id: trip.id,
          user_id: trip.user_id,
          pickup: trip.pickup,
          destination: trip.destination,
          departure_date: trip.departure_date,
          departure_time: trip.departure_time,
          arrival_date: trip.arrival_date,
          arrival_time: trip.arrival_time,
          mode_of_transport_id: trip.mode_of_transport_id,
          maximum_weight_in_kg: trip.maximum_weight_in_kg
            ? Number(trip.maximum_weight_in_kg)
            : null,
          notes: trip.notes,
          meetup_flexible: trip.meetup_flexible,
          status: trip.status,
          createdAt: trip.createdAt,
          updatedAt: trip.updatedAt,
          transport_type: trip.mode_of_transport,
          trip_items: tripItems,
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

  /**
   * Check alerts and create notifications for matching trips
   * This method runs independently after trip creation
   */
  private async checkAlertsAndCreateNotifications(
    tripId: string,
  ): Promise<void> {
    try {
      // Get the trip with all necessary data
      const trip = await this.prisma.trip.findUnique({
        where: { id: tripId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!trip) {
        console.error(`Trip ${tripId} not found for alert checking`);
        return;
      }

      // Parse trip locations
      const tripDeparture = trip.departure as any;
      const tripDestination = trip.destination as any;

      if (!tripDeparture || !tripDestination) {
        console.log(`Trip ${tripId} missing departure or destination data`);
        return;
      }

      // Create location search strings for database query
      const tripDepartureStr = JSON.stringify(tripDeparture).toLowerCase();
      const tripDestinationStr = JSON.stringify(tripDestination).toLowerCase();

      // Extract city and country from trip locations for more precise matching
      const tripDepartureCity = tripDeparture.city?.toLowerCase() || '';
      const tripDepartureCountry = tripDeparture.country?.toLowerCase() || '';
      const tripDepartureAddress = tripDeparture.address?.toLowerCase() || '';
      const tripDestinationCity = tripDestination.city?.toLowerCase() || '';
      const tripDestinationCountry =
        tripDestination.country?.toLowerCase() || '';
      const tripDestinationAddress =
        tripDestination.address?.toLowerCase() || '';

      // Build the where clause for matching alerts
      const alertWhereClause = {
        notificaction: true, // Only alerts with notification enabled
        user_id: { not: trip.user_id }, // Exclude trip creator's own alerts
        OR: [
          // Departure matches
          {
            depature: {
              mode: 'insensitive' as const,
              in: [
                tripDepartureStr,
                tripDepartureCity,
                tripDepartureCountry,
                tripDepartureAddress,
              ].filter(Boolean),
            },
          },
          // Destination matches
          {
            destination: {
              mode: 'insensitive' as const,
              in: [
                tripDestinationStr,
                tripDestinationCity,
                tripDestinationCountry,
                tripDestinationAddress,
              ].filter(Boolean),
            },
          },
        ],
        // Date range filter - if alert has date range, trip departure must be within it
        AND: [
          {
            OR: [
              // No date range specified (both dates are null)
              {
                AND: [{ form_date: null }, { to_date: null }],
              },
              // Only from_date specified (to_date is null)
              {
                AND: [
                  { form_date: { not: null } },
                  { to_date: null },
                  { form_date: { lte: trip.departure_date } },
                ],
              },
              // Only to_date specified (from_date is null)
              {
                AND: [
                  { form_date: null },
                  { to_date: { not: null } },
                  { to_date: { gte: trip.departure_date } },
                ],
              },
              // Both dates specified and trip departure is within range
              {
                AND: [
                  { form_date: { not: null } },
                  { to_date: { not: null } },
                  { form_date: { lte: trip.departure_date } },
                  { to_date: { gte: trip.departure_date } },
                ],
              },
            ],
          },
        ],
      };

      // Get matching alerts with user data in a single query
      const matchingAlerts = await this.prisma.alert.findMany({
        where: alertWhereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      // Create notifications for all matching alerts
      if (matchingAlerts.length > 0) {
        await Promise.all(
          matchingAlerts.map((alert) =>
            this.createAlertNotification(alert, trip),
          ),
        );
      }
    } catch (error) {
      console.error('Error in checkAlertsAndCreateNotifications:', error);
    }
  }

  /**
   * Create notification for alert match
   */
  private async createAlertNotification(alert: any, trip: any): Promise<void> {
    try {
      const title = await this.i18n.translate(
        'translation.notification.alertMatch.title',
        {
          lang: 'en', // Default to English for now
        },
      );

      const message = await this.i18n.translate(
        'translation.notification.alertMatch.message',
        {
          lang: 'en',
          args: {
            tripCreator: trip.user.name || trip.user.email,
            departure: JSON.stringify(trip.departure),
            destination: JSON.stringify(trip.destination),
            departureDate: trip.departure_date.toISOString().split('T')[0],
          },
        },
      );

      await this.notificationService.createNotification(
        {
          user_id: alert.user_id,
          title,
          message,
          type: 'ALERT',
          data: {
            tripId: trip.id,
            alertId: alert.id,
            tripCreatorId: trip.user_id,
            tripCreatorName: trip.user.name || trip.user.email,
            departure: trip.departure,
            destination: trip.destination,
            departureDate: trip.departure_date,
            pricePerKg: trip.price_per_kg,
            currency: trip.currency,
          },
        },
        'en', // Default to English for now
      );
    } catch (error) {
      console.error('Error creating alert notification:', error);
    }
  }
}
