import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserRequestService } from './user-request.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import { GetUserRequestsQueryDto } from './dto/get-user-requests.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@Controller('my/request')
@UseGuards(JwtAuthGuard)
@ApiTags('My Requests')
@ApiBearerAuth('JWT-auth')
export class UserRequestController {
  constructor(private readonly userRequestService: UserRequestService) {}

  @ApiOperation({
    summary: 'Get all user requests',
    description: 'Get all user requests with pagination and status filter',
  })
  @ApiResponse({
    status: 200,
    description: 'User requests retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @Get()
  async getUserRequests(
    @CurrentUser() user: User,
    @Query() query: GetUserRequestsQueryDto,
  ) {
    return this.userRequestService.getUserRequests(user.id, query);
  }
}
