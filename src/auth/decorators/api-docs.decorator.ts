import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SignupDto, SignupResponseDto } from '../dto/signup.dto';

// Auth Documentation Decorators
export const ApiSignup = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a new user account',
      description:
        'Register a new user with email, password, and optional role. Password will be hashed before storage.',
    }),
    ApiBody({
      type: SignupDto,
      description: 'User registration data',
      examples: {
        user: {
          summary: 'Regular user signup',
          value: {
            email: 'john.doe@example.com',
            password: 'SecurePassword123!',
            role: 'USER',
          },
        },
        admin: {
          summary: 'Admin user signup',
          value: {
            email: 'admin@example.com',
            password: 'AdminPassword123!',
            role: 'ADMIN',
          },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description:
        'User created successfully (message will be translated based on language)',
      type: SignupResponseDto,
      examples: {
        english: {
          summary: 'English response',
          value: {
            message: 'User created successfully',
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'john.doe@example.com',
              role: 'USER',
              createdAt: '2024-01-15T10:30:00.000Z',
            },
          },
        },
        french: {
          summary: 'French response',
          value: {
            message: 'Utilisateur créé avec succès',
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'john.doe@example.com',
              role: 'USER',
              createdAt: '2024-01-15T10:30:00.000Z',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 409,
      description:
        'User with this email already exists (message will be translated)',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 409 },
          message: {
            type: 'string',
            examples: {
              english: { value: 'User with this email already exists' },
              french: { value: 'Un utilisateur avec cet email existe déjà' },
            },
          },
          error: { type: 'string', example: 'Conflict' },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Validation error',
      schema: {
        type: 'object',
        properties: {
          statusCode: { type: 'number', example: 400 },
          message: { type: 'array', items: { type: 'string' } },
          error: { type: 'string', example: 'Bad Request' },
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
            examples: {
              english: { value: 'Failed to create user' },
              french: { value: "Échec de la création de l'utilisateur" },
            },
          },
          error: { type: 'string', example: 'Internal Server Error' },
        },
      },
    }),
  );
