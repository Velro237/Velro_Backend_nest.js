import { ApiProperty } from '@nestjs/swagger';

export class AdminTripsStatsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Trip statistics retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Trip statistics',
    type: 'object',
    properties: {
      totalTrips: {
        type: 'number',
        example: 5000,
        description: 'Total number of trips',
      },
      totalTripsThisMonth: {
        type: 'number',
        example: 450,
        description: 'Total number of trips created this month',
      },
      totalTripsLastMonth: {
        type: 'number',
        example: 380,
        description: 'Total number of trips created last month',
      },
      percentageIncrease: {
        type: 'number',
        example: 18.42,
        description:
          'Percentage increase of total trips this month compared to last month',
      },
      totalTripsInProgress: {
        type: 'number',
        example: 150,
        description: 'Total number of trips with status INPROGRESS',
      },
      totalTripsDepartingNext7Days: {
        type: 'number',
        example: 75,
        description:
          'Total number of trips with departure date within next 7 days',
      },
      totalTripsCompleted: {
        type: 'number',
        example: 3200,
        description: 'Total number of trips with status COMPLETED',
      },
      averageRequestsPerTrip: {
        type: 'number',
        example: 2.5,
        description: 'Average number of requests per trip',
      },
    },
  })
  stats!: {
    totalTrips: number;
    totalTripsThisMonth: number;
    totalTripsLastMonth: number;
    percentageIncrease: number;
    totalTripsInProgress: number;
    totalTripsDepartingNext7Days: number;
    totalTripsCompleted: number;
    averageRequestsPerTrip: number;
  };
}
