import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
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
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class TripService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async createTrip(
    createTripDto: CreateTripDto,
    lang?: string,
  ): Promise<CreateTripResponseDto> {
    const { user_id, mode_of_transport_id, trip_items, ...tripData } =
      createTripDto;

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
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

    // Check if transport type exists
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

    // Validate trip items if provided
    if (trip_items && trip_items.length > 0) {
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
        throw new NotFoundException(message);
      }
    }

    try {
      // Create trip with trip items in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the trip
        const trip = await prisma.trip.create({
          data: {
            user_id,
            mode_of_transport_id,
            pickup: tripData.pickup,
            destination: tripData.destination,
            travel_date: new Date(tripData.travel_date),
            travel_time: tripData.travel_time,
            maximum_weight_in_kg: tripData.maximum_weight_in_kg || null,
            notes: tripData.notes || null,
            fullSuitcaseOnly: tripData.fullSuitcaseOnly || false,
            price_per_kg: tripData.price_per_kg,
          },
          select: {
            id: true,
            user_id: true,
            travel_date: true,
            travel_time: true,
            price_per_kg: true,
            createdAt: true,
          },
        });

        // Create trip items if provided
        if (trip_items && trip_items.length > 0) {
          await prisma.tripItemsList.createMany({
            data: trip_items.map((item) => ({
              trip_id: trip.id,
              trip_item_id: item.trip_item_id,
              price: item.price,
            })),
          });
        }

        return {
          trip,
          trip_items: trip_items || [],
        };
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

      // Convert travel_date string to Date if provided
      if (updateData.travel_date) {
        updateData.travel_date = new Date(updateData.travel_date);
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
          travel_date: true,
          travel_time: true,
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
    try {
      const transportType = await this.prisma.transportType.create({
        data: createTransportTypeDto,
        select: {
          id: true,
          name: true,
          description: true,
          created_at: true,
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

    try {
      const transportType = await this.prisma.transportType.update({
        where: { id: transportTypeId },
        data: updateTransportTypeDto,
        select: {
          id: true,
          name: true,
          description: true,
          updated_at: true,
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
    try {
      const tripItem = await this.prisma.tripItem.create({
        data: createTripItemDto,
        select: {
          id: true,
          name: true,
          description: true,
          image_url: true,
          created_at: true,
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

    try {
      const tripItem = await this.prisma.tripItem.update({
        where: { id: tripItemId },
        data: updateTripItemDto,
        select: {
          id: true,
          name: true,
          description: true,
          image_url: true,
          updated_at: true,
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
  async getAllTransportTypes(lang?: string) {
    try {
      const transportTypes = await this.prisma.transportType.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      const message = await this.i18n.translate(
        'translation.transportType.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        transportTypes,
        count: transportTypes.length,
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
          created_at: true,
          updated_at: true,
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
  async getAllTripItems(lang?: string) {
    try {
      const tripItems = await this.prisma.tripItem.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          image_url: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      const message = await this.i18n.translate(
        'translation.tripItem.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        tripItems,
        count: tripItems.length,
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
          image_url: true,
          created_at: true,
          updated_at: true,
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
}
