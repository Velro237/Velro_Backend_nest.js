import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiQuery,
} from '@nestjs/swagger';

// USER DTOs
import { CreateUserDto } from '../dto/create-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

// REPORT DTOs
import {
  CreateReportDto,
  CreateReportResponseDto,
} from '../dto/create-report.dto';
import {
  GetReportsQueryDto,
  GetReportsResponseDto,
} from '../dto/get-reports.dto';
import {
  ReplyReportDto,
  ReplyReportResponseDto,
} from '../dto/reply-report.dto';
import {
  AdminGetAllReportsQueryDto,
  AdminGetAllReportsResponseDto,
} from '../dto/admin-get-all-reports.dto';
import {
  CreateRatingDto,
  CreateRatingResponseDto,
} from '../dto/create-rating.dto';
import {
  GetUserRatingsQueryDto,
  GetUserRatingsResponseDto,
} from '../dto/get-user-ratings.dto';
import { UserStatsResponseDto } from '../dto/user-stats.dto';

/* ------------------ HELPERS ------------------ */
const ConflictSchema = (message = 'User with this email already exists') => ({
  type: 'object',
  properties: {
    message: { type: 'string', example: message },
    error: { type: 'string', example: 'Conflict' },
    statusCode: { type: 'number', example: 409 },
  },
});

const BadRequestArraySchema = (examples: string[]) => ({
  type: 'object',
  properties: {
    message: { type: 'array', items: { type: 'string' }, example: examples },
    error: { type: 'string', example: 'Bad Request' },
    statusCode: { type: 'number', example: 400 },
  },
});

const NotFoundSchema = (msg = 'User not found') => ({
  type: 'object',
  properties: {
    message: { type: 'string', example: msg },
    error: { type: 'string', example: 'Not Found' },
    statusCode: { type: 'number', example: 404 },
  },
});

const InternalErrorSchema = (msg = 'Internal Server Error') => ({
  type: 'object',
  properties: {
    message: { type: 'string', example: msg },
    error: { type: 'string', example: 'Internal Server Error' },
    statusCode: { type: 'number', example: 500 },
  },
});

export function ApiUserWelcome() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get current user information',
      description:
        'Returns complete authenticated user information including all profile fields and KYC verification status with a personalized welcome message',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description:
        'Complete user information with KYC record and personalized message',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Hello, John Doe!' },
          user: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: '123e4567-e89b-12d3-a456-426614174000',
              },
              email: { type: 'string', example: 'john@example.com' },
              name: { type: 'string', example: 'John Doe' },
              firstName: { type: 'string', example: 'John' },
              lastName: { type: 'string', example: 'Doe' },
              phone: { type: 'string', example: '+1234567890' },
              address: { type: 'string', example: '123 Main St' },
              city: { type: 'string', example: 'New York' },
              state: { type: 'string', example: 'NY' },
              zip: { type: 'string', example: '10001' },
              picture: {
                type: 'string',
                example: 'https://example.com/profile.jpg',
              },
              device_id: { type: 'string', example: 'device-123' },
              role: { type: 'string', example: 'USER' },
              isFreightForwarder: { type: 'boolean', example: false },
              companyName: { type: 'string', example: null },
              companyAddress: { type: 'string', example: null },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              kycRecord: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string', example: 'kyc-123' },
                  status: { type: 'string', example: 'VERIFIED' },
                  provider: { type: 'string', example: 'DIDIT' },
                  rejectionReason: {
                    type: 'string',
                    nullable: true,
                    example: null,
                  },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 404 },
          message: { type: 'string', example: 'User not found' },
          error: { type: 'string', example: 'Not Found' },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 500 },
          message: {
            type: 'string',
            example: 'Failed to retrieve user information',
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );
}

export function ApiCreateReport() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new report',
      description:
        "Create a report for travel issues or other problems. Users can create reports for trips they created (e.g., reporting passengers who didn't show up). Reports can include evidence images and structured data in question-answer format. Users cannot report themselves.",
    }),
    ApiBody({
      description: 'Report creation data',
      type: CreateReportDto,
      examples: {
        travelIssue: {
          summary: 'Report travel issue with evidence',
          value: {
            reported_id: '123e4567-e89b-12d3-a456-426614174000',
            trip_id: '123e4567-e89b-12d3-a456-426614174001',
            request_id: '123e4567-e89b-12d3-a456-426614174002',
            type: 'TRAVEL_ISSUES',
            text: 'User did not show up for the scheduled pickup time',
            priority: 'HIGH',
            data: {
              'What time was pickup scheduled?': '2:00 PM',
              'How long did you wait?': '30 minutes',
              'Did you try to contact the user?': 'Yes, but no response',
            },
            images: {
              photos: [
                {
                  name: 'evidence-photo-1',
                  url: 'https://example.com/images/evidence.jpg',
                  data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...',
                  description: 'Photo showing empty pickup location',
                },
              ],
            },
          },
        },
        otherIssue: {
          summary: 'Report other issue without images',
          value: {
            reported_id: '123e4567-e89b-12d3-a456-426614174000',
            trip_id: '123e4567-e89b-12d3-a456-426614174001',
            type: 'OTHER_ISSUES',
            text: 'User was rude and unprofessional during communication',
            priority: 'LOW',
            data: {
              'Where did the issue occur?': 'In chat messages',
              'How many times did it happen?': 'Multiple times',
            },
          },
        },
        tripOwnerReport: {
          summary: 'Trip owner reporting a passenger',
          value: {
            reported_id: '123e4567-e89b-12d3-a456-426614174000',
            trip_id: '123e4567-e89b-12d3-a456-426614174001',
            request_id: '123e4567-e89b-12d3-a456-426614174002',
            type: 'TRAVEL_ISSUES',
            text: 'Passenger did not show up for the scheduled pickup time and did not respond to messages',
            priority: 'HIGH',
            data: {
              'Scheduled pickup time': '2:00 PM',
              'How long did you wait?': '45 minutes',
              'Number of attempts to contact': '3 calls and 5 messages',
              'Passenger response': 'No response',
            },
          },
        },
        replyToReport: {
          summary: 'Reply to existing report',
          value: {
            reported_id: '123e4567-e89b-12d3-a456-426614174000',
            reply_to_id: '123e4567-e89b-12d3-a456-426614174003',
            trip_id: '123e4567-e89b-12d3-a456-426614174001',
            type: 'OTHER_ISSUES',
            text: 'Admin response to the reported issue',
            priority: 'LOW',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Report created successfully',
      type: CreateReportResponseDto,
      examples: {
        success: {
          summary: 'Report created successfully',
          value: {
            message: 'Report created successfully',
            report: {
              id: '123e4567-e89b-12d3-a456-426614174004',
              user_id: '123e4567-e89b-12d3-a456-426614174005',
              reported_id: '123e4567-e89b-12d3-a456-426614174000',
              trip_id: '123e4567-e89b-12d3-a456-426614174001',
              type: 'TRAVEL_ISSUES',
              priority: 'HIGH',
              status: 'PENDING',
              created_at: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Invalid input data',
      examples: {
        validationError: {
          summary: 'Validation error',
          value: {
            message: [
              'reported_id must be a valid UUID',
              'trip_id must be a valid UUID',
              'type must be one of: TRAVEL_ISSUES, OTHER_ISSUES',
            ],
            error: 'Bad Request',
            statusCode: 400,
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      examples: {
        unauthorized: {
          summary: 'Unauthorized access',
          value: {
            message: 'Unauthorized',
            error: 'Unauthorized',
            statusCode: 401,
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - Referenced resource not found',
      examples: {
        userNotFound: {
          summary: 'Reported user not found',
          value: {
            message: 'Reported user not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
        tripNotFound: {
          summary: 'Trip not found',
          value: {
            message: 'Trip not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
        requestNotFound: {
          summary: 'Trip request not found',
          value: {
            message: 'Trip request not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
        reportNotFound: {
          summary: 'Report not found (for replies)',
          value: {
            message: 'Report not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
      },
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - Business rule violation',
      examples: {
        cannotReportSelf: {
          summary: 'Cannot report yourself',
          value: {
            message: 'You cannot report yourself',
            error: 'Conflict',
            statusCode: 409,
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to create report',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );
}

export function ApiReplyReport() {
  return applyDecorators(
    ApiOperation({
      summary: 'Reply to a report (Admin only)',
      description:
        'Create a reply to an existing report. Only users with ADMIN role can reply to reports. The reply maintains the same user_id and reported_id as the original report, with the admin ID stored in replied_by. The original report status will be updated to REPLIED.',
    }),
    ApiBody({
      description: 'Report reply data',
      type: ReplyReportDto,
      examples: {
        travelIssueReply: {
          summary: 'Reply to travel issue report',
          value: {
            report_id: '123e4567-e89b-12d3-a456-426614174000',
            text: 'Thank you for reporting this issue. We have investigated and found that the user has been suspended from our platform. We apologize for the inconvenience.',
            priority: 'HIGH',
            data: {
              'Action taken': 'User account suspended',
              'Investigation notes': 'Verified complaint with evidence',
              'Follow-up required': 'Monitor for similar issues',
            },
            images: {
              documents: [
                {
                  name: 'admin-response-1',
                  url: 'https://example.com/docs/admin-response.pdf',
                  data: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFI+PgplbmRvYmoK...',
                  description: 'Admin response documentation',
                },
              ],
            },
          },
        },
        otherIssueReply: {
          summary: 'Reply to other issue report',
          value: {
            report_id: '123e4567-e89b-12d3-a456-426614174001',
            text: 'We have reviewed your report and taken appropriate action. The matter has been resolved.',
            priority: 'LOW',
            data: {
              Resolution: 'Issue resolved',
              Notes: 'User has been contacted and issue resolved',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Report reply created successfully',
      type: ReplyReportResponseDto,
      examples: {
        success: {
          summary: 'Reply created successfully',
          value: {
            message: 'Report reply created successfully',
            reply: {
              id: '123e4567-e89b-12d3-a456-426614174002',
              user_id: '123e4567-e89b-12d3-a456-426614174004',
              reported_id: '123e4567-e89b-12d3-a456-426614174005',
              reply_to_id: '123e4567-e89b-12d3-a456-426614174000',
              trip_id: '123e4567-e89b-12d3-a456-426614174006',
              type: 'RESPONSE_TO_REPORT',
              priority: 'HIGH',
              status: 'REPLIED',
              created_at: '2024-01-15T11:45:00.000Z',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      examples: {
        unauthorized: {
          summary: 'Unauthorized access',
          value: {
            message: 'Unauthorized',
            error: 'Unauthorized',
            statusCode: 401,
          },
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Admin role required',
      examples: {
        forbidden: {
          summary: 'Insufficient permissions',
          value: {
            message: 'Access denied. Admin role required.',
            error: 'Forbidden',
            statusCode: 403,
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Report not found',
      examples: {
        notFound: {
          summary: 'Report not found',
          value: {
            message: 'Report not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to create report reply',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );
}

export function ApiGetReports() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get user reports with pagination and filtering',
      description:
        'Retrieve all reports submitted by the current user with optional filtering by type, priority, status, and trip ID.',
    }),
    ApiQuery({
      name: 'page',
      description: 'Page number for pagination',
      required: false,
      type: Number,
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      description: 'Number of reports per page (1-100)',
      required: false,
      type: Number,
      example: 10,
    }),
    ApiQuery({
      name: 'type',
      description: 'Filter by report type',
      required: false,
      enum: ['TRAVEL_ISSUES', 'OTHER_ISSUES'],
      example: 'TRAVEL_ISSUES',
    }),
    ApiQuery({
      name: 'priority',
      description: 'Filter by report priority',
      required: false,
      enum: ['HIGH', 'LOW'],
      example: 'HIGH',
    }),
    ApiQuery({
      name: 'status',
      description: 'Filter by report status',
      required: false,
      enum: ['PENDING', 'REPLIED'],
      example: 'PENDING',
    }),
    ApiQuery({
      name: 'trip_id',
      description: 'Filter by trip ID',
      required: false,
      type: String,
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Reports retrieved successfully',
      type: GetReportsResponseDto,
      examples: {
        success: {
          summary: 'Reports retrieved successfully',
          value: {
            message: 'Reports retrieved successfully',
            reports: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                reporter_user: {
                  id: '123e4567-e89b-12d3-a456-426614174005',
                  email: 'reporter@example.com',
                },
                reported_user: {
                  id: '123e4567-e89b-12d3-a456-426614174001',
                  email: 'reported@example.com',
                },
                trip: {
                  id: '123e4567-e89b-12d3-a456-426614174002',
                  pickup: { country_name: 'France', city: 'Paris' },
                  destination: { country_name: 'USA', city: 'New York' },
                  departure_date: '2024-02-01T00:00:00.000Z',
                },
                request: {
                  id: '123e4567-e89b-12d3-a456-426614174003',
                  status: 'PENDING',
                  message: 'I need help with transportation to the airport',
                  created_at: '2024-01-14T09:15:00.000Z',
                  updated_at: '2024-01-14T09:15:00.000Z',
                },
                type: 'TRAVEL_ISSUES',
                priority: 'HIGH',
                status: 'PENDING',
                text: 'User did not show up for pickup',
                data: {
                  'Scheduled pickup time': '2:00 PM',
                  'How long did you wait?': '45 minutes',
                  'Number of attempts to contact': '3 calls and 5 messages',
                },
                images: {
                  photos: [
                    {
                      name: 'evidence-photo-1',
                      url: 'https://example.com/images/evidence.jpg',
                      description: 'Photo showing empty pickup location',
                    },
                  ],
                },
                replied_by: {
                  id: '123e4567-e89b-12d3-a456-426614174007',
                  email: 'admin@example.com',
                },
                replies_count: 0,
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: '2024-01-15T10:30:00.000Z',
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
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      examples: {
        unauthorized: {
          summary: 'Unauthorized access',
          value: {
            message: 'Unauthorized',
            error: 'Unauthorized',
            statusCode: 401,
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to retrieve reports',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );
}

export function ApiAdminGetAllReports() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all reports (Admin only)',
      description:
        'Retrieve all reports in the system with advanced filtering options. Only users with ADMIN role can access this endpoint. Supports filtering by type, priority, status, trip ID, user ID (reporter or reported), replied by admin, and date range.',
    }),
    ApiQuery({
      name: 'page',
      description: 'Page number for pagination',
      required: false,
      type: Number,
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      description: 'Number of reports per page (1-100)',
      required: false,
      type: Number,
      example: 10,
    }),
    ApiQuery({
      name: 'type',
      description: 'Filter by report type',
      required: false,
      enum: ['TRAVEL_ISSUES', 'OTHER_ISSUES', 'RESPONSE_TO_REPORT'],
      example: 'TRAVEL_ISSUES',
    }),
    ApiQuery({
      name: 'priority',
      description: 'Filter by report priority',
      required: false,
      enum: ['HIGH', 'LOW'],
      example: 'HIGH',
    }),
    ApiQuery({
      name: 'status',
      description: 'Filter by report status',
      required: false,
      enum: ['PENDING', 'REPLIED'],
      example: 'PENDING',
    }),
    ApiQuery({
      name: 'trip_id',
      description: 'Filter by trip ID',
      required: false,
      type: String,
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({
      name: 'user_id',
      description: 'Filter by user ID (either reporter or reported user)',
      required: false,
      type: String,
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({
      name: 'replied_by',
      description: 'Filter by admin who replied to the report',
      required: false,
      type: String,
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({
      name: 'start_date',
      description: 'Filter reports created after this date (ISO 8601)',
      required: false,
      type: String,
      example: '2024-01-01T00:00:00.000Z',
    }),
    ApiQuery({
      name: 'end_date',
      description: 'Filter reports created before this date (ISO 8601)',
      required: false,
      type: String,
      example: '2024-12-31T23:59:59.999Z',
    }),
    ApiResponse({
      status: 200,
      description: 'All reports retrieved successfully',
      type: AdminGetAllReportsResponseDto,
      examples: {
        success: {
          summary: 'All reports retrieved successfully',
          value: {
            message: 'All reports retrieved successfully',
            reports: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                reporter_user: {
                  id: '123e4567-e89b-12d3-a456-426614174005',
                  email: 'reporter@example.com',
                },
                reported_user: {
                  id: '123e4567-e89b-12d3-a456-426614174001',
                  email: 'reported@example.com',
                },
                trip: {
                  id: '123e4567-e89b-12d3-a456-426614174002',
                  pickup: { country_name: 'France', city: 'Paris' },
                  destination: { country_name: 'USA', city: 'New York' },
                  departure_date: '2024-02-01T00:00:00.000Z',
                },
                request: {
                  id: '123e4567-e89b-12d3-a456-426614174003',
                  status: 'PENDING',
                  message: 'I need help with transportation to the airport',
                  created_at: '2024-01-14T09:15:00.000Z',
                  updated_at: '2024-01-14T09:15:00.000Z',
                },
                type: 'TRAVEL_ISSUES',
                priority: 'HIGH',
                status: 'REPLIED',
                text: 'User did not show up for pickup',
                data: {
                  'Scheduled pickup time': '2:00 PM',
                  'How long did you wait?': '45 minutes',
                  'Number of attempts to contact': '3 calls and 5 messages',
                },
                images: {
                  photos: [
                    {
                      name: 'evidence-photo-1',
                      url: 'https://example.com/images/evidence.jpg',
                      description: 'Photo showing empty pickup location',
                    },
                  ],
                },
                replied_by: {
                  id: '123e4567-e89b-12d3-a456-426614174007',
                  email: 'admin@example.com',
                },
                replies_count: 1,
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: '2024-01-15T10:30:00.000Z',
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
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      examples: {
        unauthorized: {
          summary: 'Unauthorized access',
          value: {
            message: 'Unauthorized',
            error: 'Unauthorized',
            statusCode: 401,
          },
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Admin role required',
      examples: {
        forbidden: {
          summary: 'Insufficient permissions',
          value: {
            message: 'Access denied. Admin role required.',
            error: 'Forbidden',
            statusCode: 403,
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to retrieve all reports',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );
}

/* ------------------ USER MANAGEMENT DECORATORS ------------------ */

export function ApiCreateUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new user',
      description: 'Create a new user account with email and password',
    }),
    ApiBody({
      description: 'User creation data',
      type: CreateUserDto,
      examples: {
        basicUser: {
          summary: 'Create basic user',
          value: {
            email: 'user@example.com',
            password: 'password123',
            name: 'John Doe',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'User created successfully',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Invalid input data',
      schema: BadRequestArraySchema([
        'email must be a valid email address',
        'password must be at least 6 characters',
      ]),
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - User already exists',
      schema: ConflictSchema('User with this email already exists'),
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema('Failed to create user'),
    }),
  );
}

export function ApiFindAllUsers() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all users',
      description: 'Retrieve a list of all users in the system',
    }),
    ApiResponse({
      status: 200,
      description: 'Users retrieved successfully',
      schema: {
        type: 'array',
        items: { $ref: '#/components/schemas/UserResponseDto' },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema('Failed to retrieve users'),
    }),
  );
}

export function ApiFindOneUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get user by ID',
      description: 'Retrieve a specific user by their unique identifier',
    }),
    ApiResponse({
      status: 200,
      description: 'User retrieved successfully',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Invalid UUID',
      schema: BadRequestArraySchema(['id must be a valid UUID']),
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      schema: NotFoundSchema('User not found'),
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema('Failed to retrieve user'),
    }),
  );
}

export function ApiUpdateUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update user',
      description: 'Update user information by ID',
    }),
    ApiBody({
      description: 'User update data',
      type: UpdateUserDto,
      examples: {
        updateName: {
          summary: 'Update user name',
          value: {
            name: 'Jane Doe',
          },
        },
        updatePassword: {
          summary: 'Update password',
          value: {
            password: 'newpassword123',
          },
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'User updated successfully',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Invalid input data',
      schema: BadRequestArraySchema([
        'password must be at least 6 characters',
        'name must be a string',
      ]),
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      schema: NotFoundSchema('User not found'),
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema('Failed to update user'),
    }),
  );
}

export function ApiRemoveUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete user',
      description: 'Delete a user account by ID',
    }),
    ApiResponse({
      status: 200,
      description: 'User deleted successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'User deleted successfully' },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Invalid UUID',
      schema: BadRequestArraySchema(['id must be a valid UUID']),
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      schema: NotFoundSchema('User not found'),
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema('Failed to delete user'),
    }),
  );
}

export function ApiCreateRating() {
  return applyDecorators(
    ApiOperation({
      summary: 'Rate a user',
      description:
        'Create a rating for a user based on a trip experience. Users can rate each other after completing a trip. Rating must be between 1-5 stars. Users cannot rate themselves and cannot rate the same user for the same trip twice.',
    }),
    ApiBody({
      description: 'Rating creation data',
      type: CreateRatingDto,
      examples: {
        tripOwnerRating: {
          summary: 'Trip owner rating a passenger',
          value: {
            receiver_id: '123e4567-e89b-12d3-a456-426614174000',
            trip_id: '123e4567-e89b-12d3-a456-426614174001',
            request_id: '123e4567-e89b-12d3-a456-426614174002',
            rating: 5,
            comment:
              'Excellent passenger! Very punctual and communicative. Highly recommended.',
          },
        },
        passengerRating: {
          summary: 'Passenger rating a trip owner',
          value: {
            receiver_id: '123e4567-e89b-12d3-a456-426614174003',
            trip_id: '123e4567-e89b-12d3-a456-426614174001',
            rating: 4,
            comment: 'Good service overall, but delivery was slightly delayed.',
          },
        },
        simpleRating: {
          summary: 'Simple rating without comment',
          value: {
            receiver_id: '123e4567-e89b-12d3-a456-426614174000',
            trip_id: '123e4567-e89b-12d3-a456-426614174001',
            rating: 3,
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Rating created successfully',
      type: CreateRatingResponseDto,
      examples: {
        success: {
          summary: 'Rating created successfully',
          value: {
            message: 'Rating created successfully',
            rating: {
              id: '123e4567-e89b-12d3-a456-426614174004',
              giver_id: '123e4567-e89b-12d3-a456-426614174005',
              receiver_id: '123e4567-e89b-12d3-a456-426614174000',
              trip_id: '123e4567-e89b-12d3-a456-426614174001',
              request_id: '123e4567-e89b-12d3-a456-426614174002',
              rating: 5,
              comment:
                'Excellent passenger! Very punctual and communicative. Highly recommended.',
              created_at: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Invalid input data',
      examples: {
        validationError: {
          summary: 'Validation error',
          value: {
            message: [
              'receiver_id must be a valid UUID',
              'trip_id must be a valid UUID',
              'rating must be a number between 1 and 5',
            ],
            error: 'Bad Request',
            statusCode: 400,
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      examples: {
        unauthorized: {
          summary: 'Unauthorized access',
          value: {
            message: 'Unauthorized',
            error: 'Unauthorized',
            statusCode: 401,
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - Referenced resource not found',
      examples: {
        userNotFound: {
          summary: 'User not found',
          value: {
            message: 'User not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
        tripNotFound: {
          summary: 'Trip not found',
          value: {
            message: 'Trip not found',
            error: 'Not Found',
            statusCode: 404,
          },
        },
        requestNotFound: {
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
      status: 409,
      description: 'Conflict - Business rule violation',
      examples: {
        cannotRateSelf: {
          summary: 'Cannot rate yourself',
          value: {
            message: 'You cannot rate yourself',
            error: 'Conflict',
            statusCode: 409,
          },
        },
        alreadyRated: {
          summary: 'Already rated this user for this trip',
          value: {
            message: 'You have already rated this user for this trip',
            error: 'Conflict',
            statusCode: 409,
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to create rating',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );
}

export function ApiGetUserRatings() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get user ratings',
      description:
        'Retrieve all ratings received by a specific user with pagination and filtering options. Supports filtering by rating value (1-5) and trip ID.',
    }),
    ApiQuery({
      name: 'page',
      description: 'Page number for pagination',
      required: false,
      type: Number,
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      description: 'Number of ratings per page (1-100)',
      required: false,
      type: Number,
      example: 10,
    }),
    ApiQuery({
      name: 'rating',
      description: 'Filter by rating value (1-5)',
      required: false,
      type: Number,
      example: 5,
    }),
    ApiQuery({
      name: 'trip_id',
      description: 'Filter by trip ID',
      required: false,
      type: String,
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'User ratings retrieved successfully',
      type: GetUserRatingsResponseDto,
      examples: {
        success: {
          summary: 'User ratings retrieved successfully',
          value: {
            message: 'User ratings retrieved successfully',
            ratings: [
              {
                id: '123e4567-e89b-12d3-a456-426614174000',
                giver: {
                  id: '123e4567-e89b-12d3-a456-426614174001',
                  email: 'giver@example.com',
                  name: 'John Doe',
                },
                trip: {
                  id: '123e4567-e89b-12d3-a456-426614174002',
                  pickup: { country_name: 'France', city: 'Paris' },
                  destination: { country_name: 'USA', city: 'New York' },
                  departure_date: '2024-02-01T00:00:00.000Z',
                },
                request: {
                  id: '123e4567-e89b-12d3-a456-426614174003',
                  status: 'APPROVED',
                  message: 'I need help with transportation to the airport',
                  created_at: '2024-01-14T09:15:00.000Z',
                },
                rating: 5,
                comment: 'Excellent service! Very punctual and communicative.',
                created_at: '2024-01-15T10:30:00.000Z',
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
      status: 400,
      description: 'Bad request - Invalid input data',
      examples: {
        validationError: {
          summary: 'Validation error',
          value: {
            message: [
              'user_id must be a valid UUID',
              'page must be a positive number',
              'limit must be between 1 and 100',
            ],
            error: 'Bad Request',
            statusCode: 400,
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      examples: {
        unauthorized: {
          summary: 'Unauthorized access',
          value: {
            message: 'Unauthorized',
            error: 'Unauthorized',
            statusCode: 401,
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      examples: {
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
      status: 500,
      description: 'Internal server error',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to retrieve user ratings',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );
}

export function ApiGetUserStats() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get user statistics',
      description:
        'Retrieve comprehensive statistics for a user including total trips created, average rating received, success rate (accepted requests / total requests), and related metrics.',
    }),
    ApiResponse({
      status: 200,
      description: 'User statistics retrieved successfully',
      type: UserStatsResponseDto,
      examples: {
        success: {
          summary: 'User statistics retrieved successfully',
          value: {
            message: 'User statistics retrieved successfully',
            stats: {
              totalTripsCreated: 15,
              averageRating: 4.2,
              totalRatings: 12,
              successRate: 85.5,
              totalRequests: 20,
              acceptedRequests: 17,
            },
          },
        },
        newUser: {
          summary: 'Statistics for new user',
          value: {
            message: 'User statistics retrieved successfully',
            stats: {
              totalTripsCreated: 0,
              averageRating: 0,
              totalRatings: 0,
              successRate: 0,
              totalRequests: 0,
              acceptedRequests: 0,
            },
          },
        },
        experiencedUser: {
          summary: 'Statistics for experienced user',
          value: {
            message: 'User statistics retrieved successfully',
            stats: {
              totalTripsCreated: 45,
              averageRating: 4.8,
              totalRatings: 38,
              successRate: 92.3,
              totalRequests: 65,
              acceptedRequests: 60,
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Invalid user ID',
      examples: {
        validationError: {
          summary: 'Validation error',
          value: {
            message: ['user_id must be a valid UUID'],
            error: 'Bad Request',
            statusCode: 400,
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
      examples: {
        unauthorized: {
          summary: 'Unauthorized access',
          value: {
            message: 'Unauthorized',
            error: 'Unauthorized',
            statusCode: 401,
          },
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'User not found',
      examples: {
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
      status: 500,
      description: 'Internal server error',
      examples: {
        serverError: {
          summary: 'Internal server error',
          value: {
            message: 'Failed to retrieve user statistics',
            error: 'Internal Server Error',
            statusCode: 500,
          },
        },
      },
    }),
  );
}
