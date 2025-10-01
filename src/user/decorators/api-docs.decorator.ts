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

/* ------------------ USER DECORATORS ------------------ */
export function ApiUserWelcome() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get current user information',
      description:
        'Returns the current authenticated user information with a personalized welcome message',
    }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description: 'Current user information with personalized message',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Hello, John Doe!' },
          user: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
    }),
  );
}

export function ApiCreateUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create user',
      description: 'Create a new user account',
    }),
    ApiBody({ type: CreateUserDto }),
    ApiResponse({
      status: 201,
      description: 'User created',
      type: UserResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: 'Email already exists',
      schema: ConflictSchema(),
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request',
      schema: BadRequestArraySchema(['email must be an email']),
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: InternalErrorSchema('Failed to create user'),
    }),
  );
}

export function ApiFindAllUsers() {
  return applyDecorat
