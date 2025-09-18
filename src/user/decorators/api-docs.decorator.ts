import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

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
          user: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: '123e4567-e89b-12d3-a456-426614174000',
              },
              email: { type: 'string', example: 'john@example.com' },
              role: { type: 'string', example: 'USER' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing JWT token',
    }),
  );
}
