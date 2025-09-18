import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  CreateTripRequestDto,
  CreateTripRequestResponseDto,
  CreateTripRequestImageDto,
} from '../dto/create-trip-request.dto';
import {
  TripItemImageDto,
  TripItemDetailsDto,
} from '../../shared/dto/common.dto';
import {
  GetTripRequestsQueryDto,
  GetTripRequestsResponseDto,
  TripRequestItemSummaryDto,
  TripRequestSummaryDto,
} from '../dto/get-trip-requests.dto';
import {
  UpdateTripRequestDto,
  UpdateTripRequestResponseDto,
} from '../dto/update-trip-request.dto';

// Trip Request Documentation Decorators

export const ApiCreateTripRequest = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a trip request',
      description:
        'Create a request for items from a trip. For non-full suitcase trips, trip items with quantities are required. For full suitcase trips, request items are ignored even if provided. Users cannot request items from their own trips.',
    }),
    ApiBody({
      type: CreateTripRequestDto,
      description:
        'Trip request data including trip ID, user ID, message, requested items (ignored for full suitcase trips), and images',
    }),
    ApiResponse({
      status: 201,
      description:
        'Trip request created successfully (message will be translated)',
      type: CreateTripRequestResponseDto,
      examples: {
        success: {
          summary: 'Trip request created successfully',
          value: {
            message: 'Trip request created successfully',
            request: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              trip_id: '123e4567-e89b-12d3-a456-426614174001',
              user_id: '123e4567-e89b-12d3-a456-426614174002',
              status: 'PENDING',
              message:
                'I would like to request these items for my upcoming trip',
              created_at: '2024-01-15T10:30:00.000Z',
              request_items: [
                {
                  trip_item_id: '123e4567-e89b-12d3-a456-426614174003',
                  quantity: 2,
                  special_notes: 'Please handle with care',
                  trip_item: {
                    id: '123e4567-e89b-12d3-a456-426614174003',
                    name: 'Electronics',
                    description: 'Electronic devices and gadgets',
                    image: {
                      id: '123e4567-e89b-12d3-a456-426614174004',
                      url: 'https://example.com/images/electronics.jpg',
                      alt_text: 'Electronics image',
                    },
                  },
                },
              ],
            },
          },
        },
        fullSuitcaseRequest: {
          summary: 'Full suitcase request (items ignored)',
          value: {
            message: 'Trip request created successfully',
            request: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              trip_id: '123e4567-e89b-12d3-a456-426614174001',
              user_id: '123e4567-e89b-12d3-a456-426614174002',
              status: 'PENDING',
              message: 'I would like to request space in your suitcase',
              created_at: '2024-01-15T10:30:00.000Z',
              request_items: [],
              images: [
                {
                  id: '123e4567-e89b-12d3-a456-426614174005',
                  url: 'https://example.com/images/suitcase-request.jpg',
                  alt_text: 'Items to be transported in suitcase',
                },
              ],
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        'Bad request - validation errors (message will be translated)',
      examples: {
        validationError: {
          summary: 'Validation error',
          value: {
            message: 'Validation failed',
            error: 'Bad Request',
            statusCode: 400,
            details: [
              {
                property: 'trip_id',
                constraints: {
                  isUuid: 'trip_id must be a UUID',
                },
              },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Trip or user not found (message will be translated)',
      examples: {
        tripNotFound: {
          summary: 'Trip not found',
          value: {
            message: 'Trip not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
        userNotFound: {
          summary: 'User not found',
          value: {
            message: 'User not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
      },
    }),
    ApiResponse({
      status: 409,
      description:
        'Business rule validation error (message will be translated)',
      examples: {
        cannotRequestOwnTrip: {
          summary: 'Cannot request own trip',
          value: {
            message: 'You cannot request items from your own trip',
            error: 'Conflict',
            statusCode: 409,
          },
        },
        itemsRequired: {
          summary: 'Items required for partial suitcase',
          value: {
            message: 'Trip items are required for non-full suitcase trips',
            error: 'Conflict',
            statusCode: 409,
          },
        },
        itemNotAvailable: {
          summary: 'Requested item not available',
          value: {
            message:
              'One or more requested items are not available in this trip',
            error: 'Conflict',
            statusCode: 409,
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to create trip request',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );

export const ApiGetTripRequests = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get trip requests',
      description:
        'Retrieve trip requests with optional filtering by trip, user, or status. Supports pagination.',
    }),
    ApiQuery({
      name: 'trip_id',
      required: false,
      description: 'Filter by trip ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({
      name: 'user_id',
      required: false,
      description: 'Filter by user ID',
      example: '123e4567-e89b-12d3-a456-426614174001',
    }),
    ApiQuery({
      name: 'status',
      required: false,
      description: 'Filter by request status',
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      example: 'PENDING',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      description: 'Page number for pagination',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'Number of items per page',
      example: 10,
    }),
    ApiResponse({
      status: 200,
      description:
        'Trip requests retrieved successfully (message will be translated)',
      type: GetTripRequestsResponseDto,
      examples: {
        success: {
          summary: 'Trip requests retrieved successfully',
          value: {
            message: 'Trip requests retrieved successfully',
            requests: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                trip_id: '123e4567-e89b-12d3-a456-426614174001',
                user_id: '123e4567-e89b-12d3-a456-426614174002',
                status: 'PENDING',
                message: 'I would like to request these items',
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: '2024-01-15T10:30:00.000Z',
                trip: {
                  id: '123e4567-e89b-12d3-a456-426614174001',
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
                  departure_date: '2024-02-15T10:00:00.000Z',
                  departure_time: '10:00 AM',
                  price_per_kg: 15.5,
                  fullSuitcaseOnly: false,
                },
                user: {
                  id: '123e4567-e89b-12d3-a456-426614174002',
                  email: 'requester@example.com',
                },
                request_items: [
                  {
                    trip_item_id: '123e4567-e89b-12d3-a456-426614174003',
                    quantity: 2,
                    special_notes: 'Please handle with care',
                    trip_item: {
                      id: '123e4567-e89b-12d3-a456-426614174003',
                      name: 'Electronics',
                      description: 'Electronic devices and gadgets',
                      image: {
                        id: '123e4567-e89b-12d3-a456-426614174004',
                        url: 'https://example.com/images/electronics.jpg',
                        alt_text: 'Electronics image',
                      },
                    },
                  },
                ],
                images: [
                  {
                    id: '123e4567-e89b-12d3-a456-426614174005',
                    url: 'https://example.com/images/request-1.jpg',
                    alt_text: 'Items to be transported',
                  },
                  {
                    id: '123e4567-e89b-12d3-a456-426614174006',
                    url: 'https://example.com/images/request-2.jpg',
                    alt_text: 'Additional items',
                  },
                ],
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
              hasNext: false,
              hasPrev: false,
            },
          },
        },
        emptyResult: {
          summary: 'No requests found',
          value: {
            message: 'Trip requests retrieved successfully',
            requests: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false,
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        'Bad request - invalid query parameters (message will be translated)',
      examples: {
        invalidStatus: {
          summary: 'Invalid status value',
          value: {
            message: 'Validation failed',
            error: 'Bad Request',
            statusCode: 400,
            details: [
              {
                property: 'status',
                constraints: {
                  isEnum:
                    'status must be one of the following values: PENDING, APPROVED, REJECTED, CANCELLED',
                },
              },
            ],
          },
        },
        invalidPagination: {
          summary: 'Invalid pagination parameters',
          value: {
            message: 'Validation failed',
            error: 'Bad Request',
            statusCode: 400,
            details: [
              {
                property: 'page',
                constraints: {
                  isNumber: 'page must be a number',
                  min: 'page must not be less than 1',
                },
              },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to retrieve trip requests',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );

export const ApiUpdateTripRequest = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Update a trip request',
      description:
        'Update a trip request status or message. Only the request owner or trip owner can update the request.',
    }),
    ApiParam({
      name: 'id',
      description: 'Trip request ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({
      type: UpdateTripRequestDto,
      description: 'Trip request update data',
    }),
    ApiResponse({
      status: 200,
      description:
        'Trip request updated successfully (message will be translated)',
      type: UpdateTripRequestResponseDto,
      examples: {
        statusUpdate: {
          summary: 'Status updated successfully',
          value: {
            message: 'Trip request updated successfully',
            request: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              trip_id: '123e4567-e89b-12d3-a456-426614174001',
              user_id: '123e4567-e89b-12d3-a456-426614174002',
              status: 'APPROVED',
              message: 'I would like to request these items',
              updated_at: '2024-01-15T11:00:00.000Z',
            },
          },
        },
        messageUpdate: {
          summary: 'Message updated successfully',
          value: {
            message: 'Trip request updated successfully',
            request: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              trip_id: '123e4567-e89b-12d3-a456-426614174001',
              user_id: '123e4567-e89b-12d3-a456-426614174002',
              status: 'PENDING',
              message: 'Updated message with additional details',
              updated_at: '2024-01-15T11:00:00.000Z',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description:
        'Bad request - validation errors (message will be translated)',
      examples: {
        validationError: {
          summary: 'Validation error',
          value: {
            message: 'Validation failed',
            error: 'Bad Request',
            statusCode: 400,
            details: [
              {
                property: 'status',
                constraints: {
                  isEnum:
                    'status must be one of the following values: PENDING, APPROVED, REJECTED, CANCELLED',
                },
              },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Trip request not found (message will be translated)',
      examples: {
        notFound: {
          summary: 'Trip request not found',
          value: {
            message: 'Trip request not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error (message will be translated)',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to update trip request',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );
