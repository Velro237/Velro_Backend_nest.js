import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { SignupDto, SignupResponseDto } from '../dto/signup.dto';
import { LoginDto, LoginResponseDto } from '../dto/login.dto';

export function ApiSignup() {
  return applyDecorators(
    ApiOperation({
      summary: 'User registration',
      description: 'Create a new user account with email and password',
    }),
    ApiBody({ type: SignupDto }),
    ApiResponse({
      status: 201,
      description: 'User created successfully',
      type: SignupResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: 'User with this email already exists',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'User with this email already exists',
          },
          error: {
            type: 'string',
            example: 'Conflict',
          },
          statusCode: {
            type: 'number',
            example: 409,
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input data',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: [
              'Please provide a valid email address',
              'Password must be at least 8 characters long',
            ],
          },
          error: {
            type: 'string',
            example: 'Bad Request',
          },
          statusCode: {
            type: 'number',
            example: 400,
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Failed to create user',
          },
          error: {
            type: 'string',
            example: 'Internal Server Error',
          },
          statusCode: {
            type: 'number',
            example: 500,
          },
        },
      },
    }),
  );
}

export function ApiLogin() {
  return applyDecorators(
    ApiOperation({
      summary: 'User login',
      description: 'Authenticate user with email and password',
    }),
    ApiBody({ type: LoginDto }),
    ApiResponse({
      status: 200,
      description: 'Login successful',
      type: LoginResponseDto,
    }),
    ApiResponse({
      status: 401,
      description: 'Invalid credentials',
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
    }),
  );
}
