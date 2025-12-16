import { ApiProperty } from '@nestjs/swagger';

export class AdminRequestStatsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Request statistics retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Request statistics with current and previous month data',
    type: 'object',
    properties: {
      totalRequests: {
        type: 'number',
        example: 5000,
        description: 'Total number of requests',
      },
      averageRequestPriceEUR: {
        type: 'number',
        example: 125.5,
        description: 'Average request price in EUR',
      },
      totalRequestsThisMonth: {
        type: 'number',
        example: 450,
        description: 'Total number of requests created this month',
      },
      totalRequestsLastMonth: {
        type: 'number',
        example: 380,
        description: 'Total number of requests created last month',
      },
      percentageIncrease: {
        type: 'number',
        example: 18.42,
        description:
          'Percentage increase of total requests this month compared to last month',
      },
      requestsByStatus: {
        type: 'object',
        description: 'Total requests grouped by status',
        properties: {
          total_request_pending: { type: 'number', example: 100 },
          total_request_accepted: { type: 'number', example: 50 },
          total_request_declined: { type: 'number', example: 30 },
          total_request_cancelled: { type: 'number', example: 40 },
          total_request_refunded: { type: 'number', example: 20 },
          total_request_expired: { type: 'number', example: 15 },
          total_request_confirmed: { type: 'number', example: 200 },
          total_request_sent: { type: 'number', example: 150 },
          total_request_received: { type: 'number', example: 120 },
          total_request_in_transit: { type: 'number', example: 80 },
          total_request_pending_delivery: { type: 'number', example: 60 },
          total_request_delivered: { type: 'number', example: 300 },
          total_request_reviewed: { type: 'number', example: 250 },
        },
      },
    },
  })
  stats!: {
    totalRequests: number;
    averageRequestPriceEUR: number;
    totalRequestsThisMonth: number;
    totalRequestsLastMonth: number;
    percentageIncrease: number;
    requestsByStatus: {
      total_request_pending: number;
      total_request_accepted: number;
      total_request_declined: number;
      total_request_cancelled: number;
      total_request_refunded: number;
      total_request_expired: number;
      total_request_confirmed: number;
      total_request_sent: number;
      total_request_received: number;
      total_request_in_transit: number;
      total_request_pending_delivery: number;
      total_request_delivered: number;
      total_request_reviewed: number;
    };
  };
}
