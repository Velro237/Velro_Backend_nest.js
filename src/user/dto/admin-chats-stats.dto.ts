import { ApiProperty } from '@nestjs/swagger';

export class AdminChatsStatsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Chat statistics retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Chat statistics',
    type: 'object',
    properties: {
      totalChats: {
        type: 'number',
        example: 1500,
        description: 'Total number of chats',
      },
      totalMessages: {
        type: 'number',
        example: 50000,
        description: 'Total number of messages',
      },
      totalMessagesToday: {
        type: 'number',
        example: 450,
        description: 'Total number of messages sent today',
      },
      totalMessagesThisMonth: {
        type: 'number',
        example: 12000,
        description: 'Total number of messages sent this month',
      },
      totalMessagesLastMonth: {
        type: 'number',
        example: 10000,
        description: 'Total number of messages sent last month',
      },
      percentageIncrease: {
        type: 'number',
        example: 20.0,
        description:
          'Percentage increase of messages this month compared to last month',
      },
      totalUsersOnline: {
        type: 'number',
        example: 25,
        description: 'Total number of users currently online',
      },
    },
  })
  stats!: {
    totalChats: number;
    totalMessages: number;
    totalMessagesToday: number;
    totalMessagesThisMonth: number;
    totalMessagesLastMonth: number;
    percentageIncrease: number;
    totalUsersOnline: number;
  };
}
