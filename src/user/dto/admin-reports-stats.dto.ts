import { ApiProperty } from '@nestjs/swagger';
import { ReportStatus } from 'generated/prisma';

export class AdminReportsStatsResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Report statistics retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Report statistics',
    type: 'object',
    properties: {
      totalReports: { type: 'number', example: 150 },
      reportsByStatus: {
        type: 'object',
        description: 'Total reports grouped by status',
        properties: {
          total_report_pending: { type: 'number', example: 50 },
          total_report_replied: { type: 'number', example: 100 },
          total_report_investigation: { type: 'number', example: 25 },
          total_report_resolved: { type: 'number', example: 75 },
        },
      },
      totalRepliedThisMonth: { type: 'number', example: 30 },
      averageReplyTime: {
        type: 'number',
        example: 86400000,
        description: 'Average reply time in milliseconds',
      },
      averageReplyTimeThisMonth: {
        type: 'number',
        example: 72000000,
        description: 'Average reply time this month in milliseconds',
      },
      averageReplyTimeLastMonth: {
        type: 'number',
        example: 108000000,
        description: 'Average reply time last month in milliseconds',
      },
      percentageIncreaseReplyTime: {
        type: 'number',
        example: -33.33,
        description:
          'Percentage increase in average reply time this month compared to last month',
      },
    },
  })
  stats!: {
    totalReports: number;
    reportsByStatus: {
      total_report_pending: number;
      total_report_replied: number;
      total_report_investigation: number;
      total_report_resolved: number;
    };
    totalRepliedThisMonth: number;
    averageReplyTime: number;
    averageReplyTimeThisMonth: number;
    averageReplyTimeLastMonth: number;
    percentageIncreaseReplyTime: number;
  };
}
