import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiExtraModels,
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

@ApiTags('Trips')
@ApiExtraModels(TripItemListDto)
@Controller('trip')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new trip',
    description:
      'Create a new trip for a user with required pickup/destination locations, travel details, and pricing.',
  })
  @ApiBody({
    type: CreateTripDto,
    description: 'Trip creation data',
    examples: {
      basic: {
        summary: 'Basic trip creation',
        value: {
          user_id: '123e4567-e89b-12d3-a456-426614174000',
          pickup: {
            country: 'United States',
            country_code: 'US',
            region: 'California',
            address: '123 Main St, San Francisco, CA 94105',
            lng: -122.4194,
            lat: 37.7749,
          },
          destination: {
            country: 'France',
            country_code: 'FR',
            region: 'Île-de-France',
            address: '456 Champs-Élysées, Paris, France',
            lng: 2.3522,
            lat: 48.8566,
          },
          travel_date: '2024-02-15T10:00:00.000Z',
          travel_time: '10:00 AM',
          mode_of_transport_id: '123e4567-e89b-12d3-a456-426614174001',
          maximum_weight_in_kg: 25.5,
          notes: 'Fragile items, handle with care',
          fullSuitcaseOnly: false,
          price_per_kg: 15.5,
        },
      },
      withTripItems: {
        summary: 'Trip creation with trip items',
        value: {
          user_id: '123e4567-e89b-12d3-a456-426614174000',
          pickup: {
            country: 'United States',
            country_code: 'US',
            region: 'California',
            address: '123 Main St, San Francisco, CA 94105',
            lng: -122.4194,
            lat: 37.7749,
          },
          destination: {
            country: 'France',
            country_code: 'FR',
            region: 'Île-de-France',
            address: '456 Champs-Élysées, Paris, France',
            lng: 2.3522,
            lat: 48.8566,
          },
          travel_date: '2024-02-15T10:00:00.000Z',
          travel_time: '10:00 AM',
          mode_of_transport_id: '123e4567-e89b-12d3-a456-426614174001',
          maximum_weight_in_kg: 25.5,
          notes: 'Fragile items, handle with care',
          fullSuitcaseOnly: false,
          price_per_kg: 15.5,
          trip_items: [
            {
              trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
              price: 15.5,
            },
            {
              trip_item_id: '123e4567-e89b-12d3-a456-426614174001',
              price: 25.0,
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Trip created successfully (message will be translated)',
    type: CreateTripResponseDto,
    examples: {
      english: {
        summary: 'English response',
        value: {
          message: 'Trip created successfully',
          trip: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            user_id: '123e4567-e89b-12d3-a456-426614174000',
            travel_date: '2024-02-15T10:00:00.000Z',
            travel_time: '10:00 AM',
            price_per_kg: 15.5,
            createdAt: '2024-01-15T10:30:00.000Z',
            trip_items: [
              {
                trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
                price: 15.5,
              },
              {
                trip_item_id: '123e4567-e89b-12d3-a456-426614174001',
                price: 25.0,
              },
            ],
          },
        },
      },
      french: {
        summary: 'French response',
        value: {
          message: 'Voyage créé avec succès',
          trip: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            user_id: '123e4567-e89b-12d3-a456-426614174000',
            travel_date: '2024-02-15T10:00:00.000Z',
            travel_time: '10:00 AM',
            price_per_kg: 15.5,
            createdAt: '2024-01-15T10:30:00.000Z',
            trip_items: [
              {
                trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
                price: 15.5,
              },
              {
                trip_item_id: '123e4567-e89b-12d3-a456-426614174001',
                price: 25.0,
              },
            ],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'User, transport type, or trip item not found (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          examples: {
            english: { value: 'User not found' },
            french: { value: 'Utilisateur non trouvé' },
            tripItemNotFound: { value: 'One or more trip items not found' },
            tripItemNotFoundFr: {
              value: 'Un ou plusieurs articles de voyage non trouvés',
            },
          },
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error - pickup and destination are required',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'pickup should not be empty',
            'destination should not be empty',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
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
          examples: {
            english: { value: 'Failed to create trip' },
            french: { value: 'Échec de la création du voyage' },
          },
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async createTrip(
    @Body() createTripDto: CreateTripDto,
    @I18nLang() lang: string,
  ): Promise<CreateTripResponseDto> {
    return this.tripService.createTrip(createTripDto, lang);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a trip',
    description:
      'Update an existing trip. Only the trip owner can update their trip.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateTripDto,
    description: 'Trip update data',
    examples: {
      statusUpdate: {
        summary: 'Update trip status',
        value: {
          status: 'CANCELLED',
        },
      },
      priceUpdate: {
        summary: 'Update trip price',
        value: {
          price_per_kg: 20.0,
          notes: 'Updated pricing due to fuel costs',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Trip updated successfully (message will be translated)',
    type: UpdateTripResponseDto,
    examples: {
      english: {
        summary: 'English response',
        value: {
          message: 'Trip updated successfully',
          trip: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            user_id: '123e4567-e89b-12d3-a456-426614174000',
            travel_date: '2024-02-15T10:00:00.000Z',
            travel_time: '10:00 AM',
            price_per_kg: 20.0,
            status: 'CANCELLED',
            updatedAt: '2024-01-15T10:30:00.000Z',
          },
        },
      },
      french: {
        summary: 'French response',
        value: {
          message: 'Voyage mis à jour avec succès',
          trip: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            user_id: '123e4567-e89b-12d3-a456-426614174000',
            travel_date: '2024-02-15T10:00:00.000Z',
            travel_time: '10:00 AM',
            price_per_kg: 20.0,
            status: 'CANCELLED',
            updatedAt: '2024-01-15T10:30:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          examples: {
            english: { value: 'Trip not found' },
            french: { value: 'Voyage non trouvé' },
          },
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description:
      'Unauthorized to update this trip (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          examples: {
            english: { value: 'You are not authorized to update this trip' },
            french: { value: "Vous n'êtes pas autorisé à modifier ce voyage" },
          },
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Create a new transport type',
    description: 'Create a new transport type for trip categorization.',
  })
  @ApiBody({
    type: CreateTransportTypeDto,
    description: 'Transport type creation data',
    examples: {
      airplane: {
        summary: 'Airplane transport type',
        value: {
          name: 'Airplane',
          description: 'Commercial airline transportation',
        },
      },
      train: {
        summary: 'Train transport type',
        value: {
          name: 'Train',
          description: 'Railway transportation',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Transport type created successfully (message will be translated)',
    type: CreateTransportTypeResponseDto,
    examples: {
      english: {
        summary: 'English response',
        value: {
          message: 'Transport type created successfully',
          transportType: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Airplane',
            description: 'Commercial airline transportation',
            created_at: '2024-01-15T10:30:00.000Z',
          },
        },
      },
      french: {
        summary: 'French response',
        value: {
          message: 'Type de transport créé avec succès',
          transportType: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Airplane',
            description: 'Commercial airline transportation',
            created_at: '2024-01-15T10:30:00.000Z',
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
          examples: {
            english: { value: 'Failed to create transport type' },
            french: { value: 'Échec de la création du type de transport' },
          },
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async createTransportType(
    @Body() createTransportTypeDto: CreateTransportTypeDto,
    @I18nLang() lang: string,
  ): Promise<CreateTransportTypeResponseDto> {
    return this.tripService.createTransportType(createTransportTypeDto, lang);
  }

  @Patch('transport-types/:id')
  @ApiOperation({
    summary: 'Update a transport type',
    description: 'Update an existing transport type.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transport type ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateTransportTypeDto,
    description: 'Transport type update data',
    examples: {
      nameUpdate: {
        summary: 'Update transport type name',
        value: {
          name: 'Aircraft',
        },
      },
      descriptionUpdate: {
        summary: 'Update transport type description',
        value: {
          description: 'Updated commercial airline transportation description',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Transport type updated successfully (message will be translated)',
    type: UpdateTransportTypeResponseDto,
    examples: {
      english: {
        summary: 'English response',
        value: {
          message: 'Transport type updated successfully',
          transportType: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Aircraft',
            description:
              'Updated commercial airline transportation description',
            updated_at: '2024-01-15T10:30:00.000Z',
          },
        },
      },
      french: {
        summary: 'French response',
        value: {
          message: 'Type de transport mis à jour avec succès',
          transportType: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Aircraft',
            description:
              'Updated commercial airline transportation description',
            updated_at: '2024-01-15T10:30:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Transport type not found (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          examples: {
            english: { value: 'Transport type not found' },
            french: { value: 'Type de transport non trouvé' },
          },
        },
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
        message: {
          type: 'string',
          examples: {
            english: { value: 'Failed to update transport type' },
            french: { value: 'Échec de la mise à jour du type de transport' },
          },
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Create a new trip item',
    description: 'Create a new trip item for trip categorization.',
  })
  @ApiBody({
    type: CreateTripItemDto,
    description: 'Trip item creation data',
    examples: {
      electronics: {
        summary: 'Electronics trip item',
        value: {
          name: 'Electronics',
          description: 'Electronic devices and gadgets',
          image_url: 'https://example.com/images/electronics.jpg',
        },
      },
      clothing: {
        summary: 'Clothing trip item',
        value: {
          name: 'Clothing',
          description: 'Clothes and accessories',
          image_url: 'https://example.com/images/clothing.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Trip item created successfully (message will be translated)',
    type: CreateTripItemResponseDto,
    examples: {
      english: {
        summary: 'English response',
        value: {
          message: 'Trip item created successfully',
          tripItem: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Electronics',
            description: 'Electronic devices and gadgets',
            image_url: 'https://example.com/images/electronics.jpg',
            created_at: '2024-01-15T10:30:00.000Z',
          },
        },
      },
      french: {
        summary: 'French response',
        value: {
          message: 'Article de voyage créé avec succès',
          tripItem: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Electronics',
            description: 'Electronic devices and gadgets',
            image_url: 'https://example.com/images/electronics.jpg',
            created_at: '2024-01-15T10:30:00.000Z',
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
          examples: {
            english: { value: 'Failed to create trip item' },
            french: { value: "Échec de la création de l'article de voyage" },
          },
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async createTripItem(
    @Body() createTripItemDto: CreateTripItemDto,
    @I18nLang() lang: string,
  ): Promise<CreateTripItemResponseDto> {
    return this.tripService.createTripItem(createTripItemDto, lang);
  }

  @Patch('trip-items/:id')
  @ApiOperation({
    summary: 'Update a trip item',
    description: 'Update an existing trip item.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateTripItemDto,
    description: 'Trip item update data',
    examples: {
      nameUpdate: {
        summary: 'Update trip item name',
        value: {
          name: 'Electronic Devices',
        },
      },
      imageUpdate: {
        summary: 'Update trip item image',
        value: {
          image_url: 'https://example.com/images/electronics-updated.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Trip item updated successfully (message will be translated)',
    type: UpdateTripItemResponseDto,
    examples: {
      english: {
        summary: 'English response',
        value: {
          message: 'Trip item updated successfully',
          tripItem: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Electronic Devices',
            description: 'Electronic devices and gadgets',
            image_url: 'https://example.com/images/electronics-updated.jpg',
            updated_at: '2024-01-15T10:30:00.000Z',
          },
        },
      },
      french: {
        summary: 'French response',
        value: {
          message: 'Article de voyage mis à jour avec succès',
          tripItem: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Electronic Devices',
            description: 'Electronic devices and gadgets',
            image_url: 'https://example.com/images/electronics-updated.jpg',
            updated_at: '2024-01-15T10:30:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Trip item not found (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          examples: {
            english: { value: 'Trip item not found' },
            french: { value: 'Article de voyage non trouvé' },
          },
        },
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
        message: {
          type: 'string',
          examples: {
            english: { value: 'Failed to update trip item' },
            french: { value: "Échec de la mise à jour de l'article de voyage" },
          },
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async updateTripItem(
    @Param('id') tripItemId: string,
    @Body() updateTripItemDto: UpdateTripItemDto,
    @I18nLang() lang: string,
  ): Promise<UpdateTripItemResponseDto> {
    return this.tripService.updateTripItem(tripItemId, updateTripItemDto, lang);
  }

  // GET endpoints for TransportType
  @Get('transport-types')
  @ApiOperation({
    summary: 'Get all transport types',
    description: 'Retrieve all available transport types.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Transport types retrieved successfully (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        transportTypes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        count: { type: 'number' },
      },
      examples: {
        english: {
          summary: 'English response',
          value: {
            message: 'Transport types retrieved successfully',
            transportTypes: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Airplane',
                description: 'Commercial airline transportation',
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: '2024-01-15T10:30:00.000Z',
              },
              {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Train',
                description: 'Railway transportation',
                created_at: '2024-01-14T09:15:00.000Z',
                updated_at: '2024-01-14T09:15:00.000Z',
              },
            ],
            count: 2,
          },
        },
        french: {
          summary: 'French response',
          value: {
            message: 'Types de transport récupérés avec succès',
            transportTypes: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Airplane',
                description: 'Commercial airline transportation',
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: '2024-01-15T10:30:00.000Z',
              },
              {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Train',
                description: 'Railway transportation',
                created_at: '2024-01-14T09:15:00.000Z',
                updated_at: '2024-01-14T09:15:00.000Z',
              },
            ],
            count: 2,
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
          examples: {
            english: { value: 'Failed to retrieve transport types' },
            french: {
              value: 'Échec de la récupération des types de transport',
            },
          },
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getAllTransportTypes(@I18nLang() lang: string) {
    return this.tripService.getAllTransportTypes(lang);
  }

  @Get('transport-types/:id')
  @ApiOperation({
    summary: 'Get transport type by ID',
    description: 'Retrieve a specific transport type by its ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transport type ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description:
      'Transport type retrieved successfully (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        transportType: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
      examples: {
        english: {
          summary: 'English response',
          value: {
            message: 'Transport type retrieved successfully',
            transportType: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Airplane',
              description: 'Commercial airline transportation',
              created_at: '2024-01-15T10:30:00.000Z',
              updated_at: '2024-01-15T10:30:00.000Z',
            },
          },
        },
        french: {
          summary: 'French response',
          value: {
            message: 'Type de transport récupéré avec succès',
            transportType: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Airplane',
              description: 'Commercial airline transportation',
              created_at: '2024-01-15T10:30:00.000Z',
              updated_at: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Transport type not found (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          examples: {
            english: { value: 'Transport type not found' },
            french: { value: 'Type de transport non trouvé' },
          },
        },
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
        message: {
          type: 'string',
          examples: {
            english: { value: 'Failed to retrieve transport type' },
            french: { value: 'Échec de la récupération du type de transport' },
          },
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getTransportTypeById(
    @Param('id') transportTypeId: string,
    @I18nLang() lang: string,
  ) {
    return this.tripService.getTransportTypeById(transportTypeId, lang);
  }

  // GET endpoints for TripItem
  @Get('trip-items')
  @ApiOperation({
    summary: 'Get all trip items',
    description: 'Retrieve all available trip items.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Trip items retrieved successfully (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        tripItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              image_url: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        count: { type: 'number' },
      },
      examples: {
        english: {
          summary: 'English response',
          value: {
            message: 'Trip items retrieved successfully',
            tripItems: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Electronics',
                description: 'Electronic devices and gadgets',
                image_url: 'https://example.com/images/electronics.jpg',
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: '2024-01-15T10:30:00.000Z',
              },
              {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Clothing',
                description: 'Clothes and accessories',
                image_url: 'https://example.com/images/clothing.jpg',
                created_at: '2024-01-14T09:15:00.000Z',
                updated_at: '2024-01-14T09:15:00.000Z',
              },
            ],
            count: 2,
          },
        },
        french: {
          summary: 'French response',
          value: {
            message: 'Articles de voyage récupérés avec succès',
            tripItems: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Electronics',
                description: 'Electronic devices and gadgets',
                image_url: 'https://example.com/images/electronics.jpg',
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: '2024-01-15T10:30:00.000Z',
              },
              {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Clothing',
                description: 'Clothes and accessories',
                image_url: 'https://example.com/images/clothing.jpg',
                created_at: '2024-01-14T09:15:00.000Z',
                updated_at: '2024-01-14T09:15:00.000Z',
              },
            ],
            count: 2,
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
          examples: {
            english: { value: 'Failed to retrieve trip items' },
            french: {
              value: 'Échec de la récupération des articles de voyage',
            },
          },
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getAllTripItems(@I18nLang() lang: string) {
    return this.tripService.getAllTripItems(lang);
  }

  @Get('trip-items/:id')
  @ApiOperation({
    summary: 'Get trip item by ID',
    description: 'Retrieve a specific trip item by its ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description:
      'Trip item retrieved successfully (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        tripItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            image_url: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
      examples: {
        english: {
          summary: 'English response',
          value: {
            message: 'Trip item retrieved successfully',
            tripItem: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Electronics',
              description: 'Electronic devices and gadgets',
              image_url: 'https://example.com/images/electronics.jpg',
              created_at: '2024-01-15T10:30:00.000Z',
              updated_at: '2024-01-15T10:30:00.000Z',
            },
          },
        },
        french: {
          summary: 'French response',
          value: {
            message: 'Article de voyage récupéré avec succès',
            tripItem: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Electronics',
              description: 'Electronic devices and gadgets',
              image_url: 'https://example.com/images/electronics.jpg',
              created_at: '2024-01-15T10:30:00.000Z',
              updated_at: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Trip item not found (message will be translated)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          examples: {
            english: { value: 'Trip item not found' },
            french: { value: 'Article de voyage non trouvé' },
          },
        },
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
        message: {
          type: 'string',
          examples: {
            english: { value: 'Failed to retrieve trip item' },
            french: {
              value: "Échec de la récupération de l'article de voyage",
            },
          },
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getTripItemById(
    @Param('id') tripItemId: string,
    @I18nLang() lang: string,
  ) {
    return this.tripService.getTripItemById(tripItemId, lang);
  }
}
