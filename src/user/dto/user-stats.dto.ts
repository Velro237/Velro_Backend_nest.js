import { ApiProperty } from '@nestjs/swagger';

export class UserStatsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'User statistics retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'User statistics',
    type: 'object',
    properties: {
      totalTripsCreated: {
        type: 'number',
        example: 15,
        description: 'Total number of trips created by the user',
      },
      averageRating: {
        type: 'number',
        example: 4.2,
        description: 'Average rating received by the user (1-5)',
      },
      totalRatings: {
        type: 'number',
        example: 12,
        description: 'Total number of ratings received',
      },
      successRate: {
        type: 'number',
        example: 85.5,
        description:
          'Success rate percentage (accepted requests / total requests)',
      },
      totalRequests: {
        type: 'number',
        example: 20,
        description: 'Total number of requests on user trips',
      },
      acceptedRequests: {
        type: 'number',
        example: 17,
        description: 'Number of accepted requests on user trips',
      },
    },
  })
  stats!: {
    totalTripsCreated: number;
    averageRating: number;
    totalRatings: number;
    successRate: number;
    totalRequests: number;
    acceptedRequests: number;
  };
}
