import { ApiProperty } from '@nestjs/swagger';

export class AdminUsersStatsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'User statistics retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'User statistics with current and previous month data',
    type: 'object',
    properties: {
      totalUsers: {
        type: 'number',
        example: 1250,
        description: 'Total number of users',
      },
      totalRegularUsers: {
        type: 'number',
        example: 950,
        description: 'Total number of regular users (non-business users)',
      },
      totalBusinessUsers: {
        type: 'number',
        example: 300,
        description: 'Total number of business users (freight forwarders)',
      },
      totalVerifiedUsers: {
        type: 'number',
        example: 800,
        description: 'Total number of verified users (successful KYC)',
      },
      newUsersThisMonth: {
        type: 'number',
        example: 120,
        description: 'Total number of new users created this month',
      },
      increasePercentages: {
        type: 'object',
        description: 'Percentage increase from last month',
        properties: {
          totalUsers: {
            type: 'number',
            example: 15.5,
            description: 'Percentage increase in total users from last month',
          },
          totalRegularUsers: {
            type: 'number',
            example: 12.3,
            description: 'Percentage increase in regular users from last month',
          },
          totalBusinessUsers: {
            type: 'number',
            example: 25.8,
            description:
              'Percentage increase in business users from last month',
          },
          totalVerifiedUsers: {
            type: 'number',
            example: 18.2,
            description:
              'Percentage increase in verified users from last month',
          },
          newUsersThisMonth: {
            type: 'number',
            example: -5.0,
            description:
              'Percentage increase in new users compared to last month',
          },
        },
      },
    },
  })
  stats!: {
    totalUsers: number;
    totalRegularUsers: number;
    totalBusinessUsers: number;
    totalVerifiedUsers: number;
    newUsersThisMonth: number;
    increasePercentages: {
      totalUsers: number;
      totalRegularUsers: number;
      totalBusinessUsers: number;
      totalVerifiedUsers: number;
      newUsersThisMonth: number;
    };
  };
}
