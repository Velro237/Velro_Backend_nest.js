import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateTripDto, CreateTripResponseDto } from '../dto/create-trip.dto';
import { UpdateTripDto, UpdateTripResponseDto } from '../dto/update-trip.dto';

import {
  CreateTransportTypeDto,
  CreateTransportTypeResponseDto,
} from '../dto/create-transport-type.dto';
import {
  UpdateTransportTypeDto,
  UpdateTransportTypeResponseDto,
} from '../dto/update-transport-type.dto';
import {
  CreateTripItemDto,
  CreateTripItemResponseDto,
} from '../dto/create-trip-item.dto';
import {
  UpdateTripItemDto,
  UpdateTripItemResponseDto,
} from '../dto/update-trip-item.dto';
import { GetTripsQueryDto, GetTripsResponseDto } from '../dto/get-trips.dto';
import {
  GetTransportTypesQueryDto,
  GetTransportTypesResponseDto,
} from '../dto/get-transport-types.dto';
import {
  GetTripItemsQueryDto,
  GetTripItemsResponseDto,
} from '../dto/get-trip-items.dto';
import { GetTripByIdResponseDto } from '../dto/get-trip-by-id.dto';

// Trip Documentation Decorators
export const ApiCreateTrip = () =>
  applyDecorators(
    ApiBearerAuth('JWT-auth'),
    ApiOperation({
      summary: 'Create a new trip',
      description:
        'Create a new trip for a user with required pickup/destination locations, travel details, and trip items. At least one trip item is always required.',
    }),
    ApiBody({
      type: CreateTripDto,
      description: 'Test trip creation with trip items',
    }),
    ApiResponse({
      status: 201,
      description: 'Trip created successfully (message will be translated)',
      type: CreateTripResponseDto,
      examples: {
        success: {
          summary: 'Trip created successfully',
          value: {
            message: 'Trip created successfully',
            trip: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              user_id: '123e4567-e89b-12d3-a456-426614174000',
              departure_date: '2024-02-15T10:00:00.000Z',
              departure_time: '10:00 AM',
              currency: 'USD',
              airline_id: '123e4567-e89b-12d3-a456-426614174002',
              createdAt: '2024-01-15T10:30:00.000Z',
              trip_items: [
                {
                  trip_item_id: '123e4567-e89b-12d3-a456-426614174000',
                  price: 15.5,
                  available_kg: 5.0,
                },
                {
                  trip_item_id: '123e4567-e89b-12d3-a456-426614174001',
                  price: 25.0,
                  available_kg: 3.5,
                },
              ],
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description:
        'User, transport type, airline, or trip item not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: {
            type: 'string',
            examples: {
              userNotFound: { value: 'User not found' },
              transportNotFound: { value: 'Transport type not found' },
              airlineNotFound: { value: 'Airline not found' },
              tripItemNotFound: { value: 'One or more trip items not found' },
            },
          },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
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
    }),
    ApiResponse({
      status: 409,
      description:
        'Business rule validation error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 409 },
          message: {
            type: 'string',
            examples: {
              tripItemsRequired: {
                value: 'At least one trip item is required for all trips',
              },
              tripItemNotFound: {
                value: 'One or more selected trip items do not exist',
              },
            },
          },
          error: { type: 'string', example: 'Conflict' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to create trip',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiUpdateTrip = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update a trip',
      description:
        'Update an existing trip. Only the trip owner can update their trip.',
    }),
    ApiParam({
      name: 'id',
      description: 'Trip ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({
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
          summary: 'Update trip notes',
          value: {
            notes: 'Updated notes due to schedule changes',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Trip updated successfully (message will be translated)',
      type: UpdateTripResponseDto,
      examples: {
        success: {
          summary: 'Trip updated successfully',
          value: {
            message: 'Trip updated successfully',
            trip: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              user_id: '123e4567-e89b-12d3-a456-426614174000',
              departure_date: '2024-02-15T10:00:00.000Z',
              departure_time: '10:00 AM',
              status: 'CANCELLED',
              updatedAt: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Trip not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: {
            type: 'string',
            example: 'Trip not found',
          },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
      status: 403,
      description:
        'Unauthorized to update this trip (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 403 },
          message: {
            type: 'string',
            example: 'You are not authorized to update this trip',
          },
          error: { type: 'string', example: 'Forbidden' },
        },
      },
    }),
  );

// Transport Type Documentation Decorators
export const ApiCreateTransportType = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a new transport type (Admin Only)',
      description:
        'Create a new transport type for trip categorization. Requires admin privileges.',
    }),
    ApiBody({
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
    }),
    ApiResponse({
      status: 201,
      description:
        'Transport type created successfully (message will be translated)',
      type: CreateTransportTypeResponseDto,
      examples: {
        success: {
          summary: 'Transport type created successfully',
          value: {
            message: 'Transport type created successfully',
            transportType: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Airplane',
              description: 'Commercial airline transportation',
            },
          },
        },
      },
    }),
    ApiResponse({
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
    }),
    ApiResponse({
      status: 409,
      description:
        'Transport type name already exists (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 409 },
          message: {
            type: 'string',
            example: 'Transport type with this name already exists',
          },
          error: { type: 'string', example: 'Conflict' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to create transport type',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiUpdateTransportType = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update a transport type (Admin Only)',
      description:
        'Update an existing transport type. Requires admin privileges.',
    }),
    ApiParam({
      name: 'id',
      description: 'Transport type ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({
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
            description:
              'Updated commercial airline transportation description',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description:
        'Transport type updated successfully (message will be translated)',
      type: UpdateTransportTypeResponseDto,
      examples: {
        success: {
          summary: 'Transport type updated successfully',
          value: {
            message: 'Transport type updated successfully',
            transportType: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Aircraft',
              description:
                'Updated commercial airline transportation description',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Transport type not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: {
            type: 'string',
            example: 'Transport type not found',
          },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
      status: 409,
      description:
        'Transport type name already exists (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 409 },
          message: {
            type: 'string',
            example: 'Transport type with this name already exists',
          },
          error: { type: 'string', example: 'Conflict' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to update transport type',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiGetAllTransportTypes = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get all transport types with pagination',
      description:
        'Retrieve all available transport types with pagination support.',
    }),
    ApiResponse({
      status: 200,
      description:
        'Transport types retrieved successfully (message will be translated)',
      type: GetTransportTypesResponseDto,
      examples: {
        success: {
          summary: 'Successful response with pagination',
          value: {
            message: 'Transport types retrieved successfully',
            transportTypes: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Airplane',
                description: 'Commercial airline transportation',
              },
              {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Train',
                description: 'Railway transportation',
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
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to retrieve transport types',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiGetTransportTypeById = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get transport type by ID',
      description: 'Retrieve a specific transport type by its ID.',
    }),
    ApiParam({
      name: 'id',
      description: 'Transport type ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
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
            },
          },
        },
        examples: {
          success: {
            summary: 'Transport type retrieved successfully',
            value: {
              message: 'Transport type retrieved successfully',
              transportType: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Airplane',
                description: 'Commercial airline transportation',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Transport type not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: {
            type: 'string',
            example: 'Transport type not found',
          },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to retrieve transport type',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

// Trip Item Documentation Decorators
export const ApiCreateTripItem = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a new trip item (Admin Only)',
      description:
        'Create a new trip item for trip categorization with optional multilingual translations. You can provide translations for name and description in different languages (en, fr). Requires admin privileges.',
    }),
    ApiBody({
      type: CreateTripItemDto,
      description: 'Trip item creation data with optional translations',
      examples: {
        electronics: {
          summary: 'Electronics trip item with translations',
          value: {
            name: 'Electronics',
            description: 'Electronic devices and gadgets',
            image_id: '123e4567-e89b-12d3-a456-426614174000',
            translations: [
              {
                language: 'fr',
                name: 'Électronique',
                description: 'Appareils et gadgets électroniques',
              },
            ],
          },
        },
        clothing: {
          summary: 'Clothing trip item with translations',
          value: {
            name: 'Clothing',
            description: 'Clothes and accessories',
            image_id: '123e4567-e89b-12d3-a456-426614174001',
            translations: [
              {
                language: 'FR',
                name: 'Vêtements',
                description: 'Vêtements et accessoires',
              },
            ],
          },
        },
        electronicsWithoutTranslations: {
          summary: 'Electronics trip item without translations',
          value: {
            name: 'Electronics',
            description: 'Electronic devices and gadgets',
            image_id: '123e4567-e89b-12d3-a456-426614174000',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description:
        'Trip item created successfully (message will be translated)',
      type: CreateTripItemResponseDto,
      examples: {
        success: {
          summary: 'Trip item created successfully with translations',
          value: {
            message: 'Trip item created successfully',
            tripItem: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Electronics',
              description: 'Electronic devices and gadgets',
              image: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                url: 'https://example.com/images/electronics.jpg',
                alt_text: 'Electronics image',
              },
              translations: [
                {
                  id: '123e4567-e89b-12d3-a456-426614174001',
                  language: 'fr',
                  name: 'Électronique',
                  description: 'Appareils et gadgets électroniques',
                },
              ],
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 409,
      description: 'Trip item name already exists (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 409 },
          message: {
            type: 'string',
            example: 'Trip item with this name already exists',
          },
          error: { type: 'string', example: 'Conflict' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to create trip item',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiUpdateTripItem = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update a trip item (Admin Only)',
      description: 'Update an existing trip item. Requires admin privileges.',
    }),
    ApiParam({
      name: 'id',
      description: 'Trip item ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({
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
            image: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              url: 'https://example.com/images/electronics-updated.jpg',
              alt_text: 'Updated electronics image',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description:
        'Trip item updated successfully (message will be translated)',
      type: UpdateTripItemResponseDto,
      examples: {
        success: {
          summary: 'Trip item updated successfully',
          value: {
            message: 'Trip item updated successfully',
            tripItem: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Electronic Devices',
              description: 'Electronic devices and gadgets',
              image: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                url: 'https://example.com/images/electronics-updated.jpg',
                alt_text: 'Updated electronics image',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Trip item not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: {
            type: 'string',
            example: 'Trip item not found',
          },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
      status: 409,
      description: 'Trip item name already exists (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 409 },
          message: {
            type: 'string',
            example: 'Trip item with this name already exists',
          },
          error: { type: 'string', example: 'Conflict' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to update trip item',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiGetAllTripItems = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get all trip items with pagination',
      description: 'Retrieve all available trip items with pagination support.',
    }),
    ApiResponse({
      status: 200,
      description:
        'Trip items retrieved successfully (message will be translated)',
      type: GetTripItemsResponseDto,
      examples: {
        success: {
          summary: 'Successful response with pagination',
          value: {
            message: 'Trip items retrieved successfully',
            tripItems: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Electronics',
                description: 'Electronic devices and gadgets',
                image: {
                  id: '123e4567-e89b-12d3-a456-426614174000',
                  url: 'https://example.com/images/electronics.jpg',
                  alt_text: 'Electronics image',
                },
              },
              {
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'Clothing',
                description: 'Clothes and accessories',
                image: {
                  id: '123e4567-e89b-12d3-a456-426614174001',
                  url: 'https://example.com/images/clothing.jpg',
                  alt_text: 'Clothing image',
                },
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
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to retrieve trip items',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );

export const ApiGetTripItemById = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get trip item by ID',
      description: 'Retrieve a specific trip item by its ID.',
    }),
    ApiParam({
      name: 'id',
      description: 'Trip item ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
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
            },
          },
        },
        examples: {
          success: {
            summary: 'Trip item retrieved successfully',
            value: {
              message: 'Trip item retrieved successfully',
              tripItem: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Electronics',
                description: 'Electronic devices and gadgets',
                image: {
                  id: '123e4567-e89b-12d3-a456-426614174000',
                  url: 'https://example.com/images/electronics.jpg',
                  alt_text: 'Electronics image',
                },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Trip item not found (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: {
            type: 'string',
            example: 'Trip item not found',
          },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to retrieve trip item',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );
