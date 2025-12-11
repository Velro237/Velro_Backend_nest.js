import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuthService } from '../auth/auth.service';
import {
  AdminGetAllReportsQueryDto,
  AdminGetAllReportsResponseDto,
} from './dto/admin-get-all-reports.dto';
import { ReplyReportDto, ReplyReportResponseDto } from './dto/reply-report.dto';
import {
  AdminGetDeleteRequestsQueryDto,
  AdminGetDeleteRequestsResponseDto,
} from '../auth/dto/admin-get-delete-requests.dto';
import {
  AdminChangePasswordDto,
  AdminChangePasswordResponseDto,
} from './dto/admin-change-password.dto';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  ApiReplyReport,
  ApiAdminGetAllReports,
} from './decorators/api-docs.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import { AdminUsersStatsResponseDto } from './dto/admin-users-stats.dto';
import {
  AdminGetAllUsersQueryDto,
  AdminGetAllUsersResponseDto,
} from './dto/admin-get-all-users.dto';
import { AdminUserDetailsResponseDto } from './dto/admin-user-details.dto';
import { AdminUserWalletResponseDto } from './dto/admin-user-wallet.dto';
import {
  PaginationQueryDto,
  ChangeWalletStateDto,
  ChangeWalletStateResponseDto,
} from '../wallet/dto/wallet.dto';
import { WalletService } from '../wallet/wallet.service';
import {
  AdminGetTripsQueryDto,
  AdminGetTripsResponseDto,
} from './dto/admin-user-trips.dto';
import {
  AdminSuspendUserDto,
  AdminSuspendUserResponseDto,
} from './dto/admin-suspend-user.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly walletService: WalletService,
  ) {}

  @Get('reports')
  @ApiAdminGetAllReports()
  async getAllReports(
    @Query() query: AdminGetAllReportsQueryDto,
    @I18nLang() lang: string,
  ): Promise<AdminGetAllReportsResponseDto> {
    return this.userService.getAllReports(query, lang);
  }

  @Post('report/reply')
  @HttpCode(HttpStatus.CREATED)
  @ApiReplyReport()
  async replyToReport(
    @Body() replyReportDto: ReplyReportDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<ReplyReportResponseDto> {
    return this.userService.replyToReport(replyReportDto, user.id, lang);
  }

  @Get('account-delete-requests')
  @ApiOperation({
    summary: 'Get all account delete requests',
    description:
      'Retrieve all account deletion requests with optional status filtering and pagination. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account delete requests retrieved successfully',
    type: AdminGetDeleteRequestsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getAllAccountDeleteRequests(
    @Query() query: AdminGetDeleteRequestsQueryDto,
    @I18nLang() lang: string,
  ): Promise<AdminGetDeleteRequestsResponseDto> {
    return this.authService.getAllAccountDeleteRequests(query, lang);
  }

  @Post('user/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change user password by email (Admin only)',
    description:
      'Admin endpoint to change a user password by providing their email address and new password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: AdminChangePasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async changeUserPassword(
    @Body() adminChangePasswordDto: AdminChangePasswordDto,
    @I18nLang() lang: string,
  ): Promise<AdminChangePasswordResponseDto> {
    return this.userService.adminChangePassword(adminChangePasswordDto, lang);
  }

  @Get('users/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user statistics (Admin only)',
    description:
      'Retrieve comprehensive user statistics including total users, regular users, business users, verified users, new users this month, and percentage increases from last month.',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    type: AdminUsersStatsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUsersStats(
    @I18nLang() lang: string,
  ): Promise<AdminUsersStatsResponseDto> {
    return this.userService.getAdminUsersStats(lang);
  }

  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all users with filters (Admin only)',
    description:
      'Retrieve all users with search and status filters. Returns user information including stats like total requests, trips, revenue, ratings, and status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: AdminGetAllUsersResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getAllUsers(
    @Query() query: AdminGetAllUsersQueryDto,
    @I18nLang() lang: string,
  ): Promise<AdminGetAllUsersResponseDto> {
    return this.userService.getAllUsersAdmin(query, lang);
  }

  @Get('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user details by ID (Admin only)',
    description:
      'Retrieve comprehensive user details including all user information, average rating, total trips, total requests sent, total requests completed, and total requests reviewed.',
  })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    type: AdminUserDetailsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUserDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @I18nLang() lang: string,
  ): Promise<AdminUserDetailsResponseDto> {
    return this.userService.getAdminUserDetails(id, lang);
  }

  @Get('users/wallet/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user wallet information with transactions (Admin only)',
    description:
      'Retrieve wallet information and paginated transactions for a specific user. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'User wallet information retrieved successfully',
    type: AdminUserWalletResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid UUID or pagination parameters',
  })
  @ApiResponse({
    status: 404,
    description: 'User or wallet not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUserWallet(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() paginationDto: PaginationQueryDto,
    @I18nLang() lang: string,
  ): Promise<AdminUserWalletResponseDto> {
    return this.userService.getAdminUserWallet(userId, paginationDto, lang);
  }

  @Patch('users/:userId/wallet/state')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change wallet state (Admin only)',
    description:
      "Allows admins to change a user's wallet state between ACTIVE and BLOCKED. Optionally provide status_message_en and/or status_message_fr explaining the change.",
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID whose wallet state to change',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: ChangeWalletStateDto,
    description: 'Wallet state change data',
    examples: {
      activate: {
        summary: 'Activate wallet',
        value: {
          state: 'ACTIVE',
          status_message_en: 'Wallet activated after verification',
          status_message_fr: 'Portefeuille activé après vérification',
        },
      },
      block: {
        summary: 'Block wallet',
        value: {
          state: 'BLOCKED',
          status_message_en: 'Wallet blocked due to suspicious activity',
          status_message_fr:
            "Portefeuille bloqué en raison d'une activité suspecte",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet state changed successfully',
    type: ChangeWalletStateResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async changeWalletState(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeWalletStateDto,
  ): Promise<ChangeWalletStateResponseDto> {
    return this.walletService.changeWalletState(userId, dto);
  }

  @Get('trips')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get trips with statistics (Admin only)',
    description:
      'Retrieve all trips with optional filters. Can filter by userId, status, searchKey (trip ID, departure city/country, destination city/country), and date range (createdAt). Returns trip information including total requests per trip and revenue per trip in EUR.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trips retrieved successfully',
    type: AdminGetTripsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getTrips(
    @Query() query: AdminGetTripsQueryDto,
    @I18nLang() lang: string,
  ): Promise<AdminGetTripsResponseDto> {
    return this.userService.getAdminTrips(query, lang);
  }

  @Patch('users/:userId/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend or unsuspend a user (Admin only)',
    description:
      'Suspend or unsuspend a user account. When suspended, users cannot log in. Optionally provide status messages in English and French explaining the suspension.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to suspend/unsuspend',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: AdminSuspendUserDto,
    description: 'Suspension data',
    examples: {
      suspend: {
        summary: 'Suspend user',
        value: {
          suspended: true,
          status_message_en:
            'Account suspended due to violation of terms of service',
          status_message_fr:
            'Compte suspendu en raison de violation des conditions de service',
        },
      },
      unsuspend: {
        summary: 'Unsuspend user',
        value: {
          suspended: false,
          status_message_en: null,
          status_message_fr: null,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User suspension status updated successfully',
    type: AdminSuspendUserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async suspendUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdminSuspendUserDto,
    @I18nLang() lang: string,
  ): Promise<AdminSuspendUserResponseDto> {
    return this.userService.suspendUser(userId, dto, lang);
  }
}
