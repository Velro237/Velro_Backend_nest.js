import { Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Scheduler')
@ApiBearerAuth('JWT-auth')
@Controller('scheduler')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('trigger-alert-check')
  @ApiOperation({
    summary: 'Manually trigger alert check (Admin only)',
    description:
      'Manually trigger the alert checking process for testing purposes. This will check all trips created in the last hour and match them against alerts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert check triggered successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Alert check triggered successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async triggerAlertCheck() {
    await this.schedulerService.triggerAlertCheck();
    return {
      message: 'Alert check triggered successfully',
    };
  }

  @Post('trigger-trip-status-update')
  @ApiOperation({
    summary: 'Manually trigger trip status update (Admin only)',
    description:
      'Manually trigger the trip status update process. This will update all trips to INPROGRESS or COMPLETED based on their departure and arrival dates.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip status update triggered successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Trip status update triggered successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async triggerTripStatusUpdate() {
    await this.schedulerService.triggerTripStatusUpdate();
    return {
      message: 'Trip status update triggered successfully',
    };
  }
}
