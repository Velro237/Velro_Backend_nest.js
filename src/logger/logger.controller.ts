import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { LoggerService } from './logger.service';
import { GetLogsQueryDto, GetLogsResponseDto } from './dto/get-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Logger')
@ApiBearerAuth('JWT-auth')
@Controller('logger')
@UseGuards(JwtAuthGuard)
export class LoggerController {
  constructor(private readonly loggerService: LoggerService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Get logs by user ID',
    description:
      'Retrieve logs for a specific user with pagination and optional filtering by logger type. Default type filter is ALL.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logs retrieved successfully',
    type: GetLogsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getLogsByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: GetLogsQueryDto,
  ): Promise<GetLogsResponseDto> {
    return this.loggerService.getLogsByUserId(userId, query);
  }
}
