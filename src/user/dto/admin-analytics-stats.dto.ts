import { ApiProperty } from '@nestjs/swagger';

export class AdminAnalyticsStatsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Analytics statistics retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Analytics statistics with monthly comparison',
    type: 'object',
    properties: {
      totalRevenueEUR: {
        type: 'number',
        example: 125000.5,
        description:
          'Total revenue in EUR (sum of request costs, excluding PENDING, ACCEPTED, DECLINED, CANCELLED, EXPIRED)',
      },
      totalAvailableWalletFundsEUR: {
        type: 'number',
        example: 50000.25,
        description:
          'Total available wallet funds in EUR (sum of all available balances)',
      },
      totalHoldWalletFundsEUR: {
        type: 'number',
        example: 25000.75,
        description:
          'Total hold wallet funds in EUR (sum of all hold balances)',
      },
      totalUsers: {
        type: 'number',
        example: 1500,
        description: 'Total number of users',
      },
      totalVerifiedUsers: {
        type: 'number',
        example: 1200,
        description: 'Total number of verified users (successful KYC)',
      },
      totalActiveRequests: {
        type: 'number',
        example: 350,
        description:
          'Total active requests (excluding DECLINED, EXPIRED, REFUNDED, REVIEWED)',
      },
      totalActiveTrips: {
        type: 'number',
        example: 200,
        description:
          'Total active trips (status: SCHEDULED, RESCHEDULED, INPROGRESS)',
      },
      totalPlatformFeeEUR: {
        type: 'number',
        example: 8750.35,
        description:
          'Total platform fee in EUR (sum of all request fees, excluding PENDING, ACCEPTED, DECLINED, CANCELLED, EXPIRED)',
      },
      increasePercentages: {
        type: 'object',
        description: 'Percentage increase from last month',
        properties: {
          totalRevenueEUR: {
            type: 'number',
            example: 15.5,
            description: 'Percentage increase in total revenue from last month',
          },
          totalAvailableWalletFundsEUR: {
            type: 'number',
            example: 12.3,
            description:
              'Percentage increase in available wallet funds from last month',
          },
          totalHoldWalletFundsEUR: {
            type: 'number',
            example: 8.7,
            description:
              'Percentage increase in hold wallet funds from last month',
          },
          totalUsers: {
            type: 'number',
            example: 10.2,
            description: 'Percentage increase in total users from last month',
          },
          totalVerifiedUsers: {
            type: 'number',
            example: 14.5,
            description:
              'Percentage increase in verified users from last month',
          },
          totalActiveRequests: {
            type: 'number',
            example: 20.8,
            description:
              'Percentage increase in active requests from last month',
          },
          totalActiveTrips: {
            type: 'number',
            example: 18.3,
            description: 'Percentage increase in active trips from last month',
          },
          totalPlatformFeeEUR: {
            type: 'number',
            example: 15.5,
            description: 'Percentage increase in platform fee from last month',
          },
        },
      },
    },
  })
  stats!: {
    totalRevenueEUR: number;
    totalAvailableWalletFundsEUR: number;
    totalHoldWalletFundsEUR: number;
    totalUsers: number;
    totalVerifiedUsers: number;
    totalActiveRequests: number;
    totalActiveTrips: number;
    totalPlatformFeeEUR: number;
    increasePercentages: {
      totalRevenueEUR: number;
      totalAvailableWalletFundsEUR: number;
      totalHoldWalletFundsEUR: number;
      totalUsers: number;
      totalVerifiedUsers: number;
      totalActiveRequests: number;
      totalActiveTrips: number;
      totalPlatformFeeEUR: number;
    };
  };
}
