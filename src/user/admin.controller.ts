import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
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
import { AdminReportsStatsResponseDto } from './dto/admin-reports-stats.dto';
import { AdminGetReportByIdResponseDto } from './dto/admin-get-report-by-id.dto';
import {
  AdminChangeReportStatusDto,
  AdminChangeReportStatusResponseDto,
} from './dto/admin-change-report-status.dto';
import {
  AdminMoveHoldBalanceDto,
  AdminMoveHoldBalanceResponseDto,
} from './dto/admin-move-hold-balance.dto';
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
import { AdminRequestStatsResponseDto } from './dto/admin-request-stats.dto';
import {
  AdminGetRequestsQueryDto,
  AdminGetRequestsResponseDto,
} from './dto/admin-get-requests.dto';
import {
  UpdateTripRequestDto,
  UpdateTripRequestResponseDto,
} from '../request/dto/update-trip-request.dto';
import {
  AdminEditRequestDto,
  AdminEditRequestResponseDto,
} from '../request/dto/admin-edit-request.dto';
import { AdminDeleteRequestResponseDto } from '../request/dto/admin-delete-request.dto';
import { AdminGetRequestByIdResponseDto } from '../request/dto/admin-get-request-by-id.dto';
import { RequestService } from '../request/request.service';
import { AdminChatsStatsResponseDto } from './dto/admin-chats-stats.dto';
import { AdminTripsStatsResponseDto } from './dto/admin-trips-stats.dto';
import {
  AdminFlagContentDto,
  AdminFlagContentResponseDto,
} from './dto/admin-flag-content.dto';
import { ChatService } from '../chat/chat.service';
import { TripService } from '../trip/trip.service';
import { AdminGetTripByIdResponseDto } from '../trip/dto/admin-get-trip-by-id.dto';
import { AdminDeleteTripResponseDto } from '../trip/dto/admin-delete-trip.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { AdminPaymentMethodRankingResponseDto } from '../payment/dto/admin-payment-method-ranking.dto';
import { AdminPackageCategoryResponseDto } from '../trip/dto/admin-package-category.dto';
import { AdminRequestStatusDistributionResponseDto } from './dto/admin-request-status-distribution.dto';
import {
  GetChatsQueryDto,
  GetChatsResponseDto,
} from '../chat/dto/get-chats.dto';
import {
  GetMessagesQueryDto,
  GetMessagesResponseDto,
} from '../chat/dto/get-messages.dto';
import {
  AdminSendWarningDto,
  AdminSendWarningResponseDto,
} from './dto/admin-send-warning.dto';
import { AdminAnalyticsStatsResponseDto } from './dto/admin-analytics-stats.dto';
import {
  AdminRoutesPerVolumeQueryDto,
  AdminRoutesPerVolumeResponseDto,
} from './dto/admin-routes-per-volume.dto';
import {
  AdminUsersRankingQueryDto,
  AdminUsersRankingResponseDto,
} from './dto/admin-users-ranking.dto';
import {
  AdminUsersPerCountryResponseDto,
} from './dto/admin-users-per-country.dto';
import {
  AdminShippingOriginsResponseDto,
} from './dto/admin-shipping-origins.dto';
import {
  AdminRefundRequestDto,
  AdminRefundResponseDto,
} from '../payment/dto/admin-refund-request.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly walletService: WalletService,
    private readonly requestService: RequestService,
    private readonly chatService: ChatService,
    private readonly tripService: TripService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('reports/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get report statistics (Admin only)',
    description:
      'Retrieve comprehensive report statistics including total reports, reports per status, total replied this month, average reply time, and percentage increase of average reply time this month compared to last month.',
  })
  @ApiResponse({
    status: 200,
    description: 'Report statistics retrieved successfully',
    type: AdminReportsStatsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getReportsStats(
    @I18nLang() lang: string,
  ): Promise<AdminReportsStatsResponseDto> {
    return this.userService.getAdminReportsStats(lang);
  }

  @Get('reports')
  @ApiAdminGetAllReports()
  async getAllReports(
    @Query() query: AdminGetAllReportsQueryDto,
    @I18nLang() lang: string,
  ): Promise<AdminGetAllReportsResponseDto> {
    return this.userService.getAllReports(query, lang);
  }

  @Get('reports/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get report by ID with comprehensive details (Admin only)',
    description:
      'Retrieve complete report information including all report data, reporter user (with firstName, lastName, KYC), reported user (with firstName, lastName, KYC), full trip details (with trip owner firstName, lastName, KYC), full request details (with request user firstName, lastName, KYC), and replier information.',
  })
  @ApiParam({
    name: 'id',
    description: 'Report ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Report retrieved successfully',
    type: AdminGetReportByIdResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Report not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getReportById(
    @Param('id', ParseUUIDPipe) reportId: string,
    @I18nLang() lang: string,
  ): Promise<AdminGetReportByIdResponseDto> {
    return this.userService.getAdminReportById(reportId, lang);
  }

  @Patch('reports/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change report status (Admin only)',
    description:
      'Update the status of a report. Only original reports (not replies) can have their status changed. Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Report ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: AdminChangeReportStatusDto,
    description: 'Report status update data',
  })
  @ApiResponse({
    status: 200,
    description: 'Report status updated successfully',
    type: AdminChangeReportStatusResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Invalid input data or cannot change reply report status',
  })
  @ApiResponse({
    status: 404,
    description: 'Report not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async changeReportStatus(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() dto: AdminChangeReportStatusDto,
    @I18nLang() lang: string,
  ): Promise<AdminChangeReportStatusResponseDto> {
    return this.userService.changeReportStatus(reportId, dto.status, lang);
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

  @Get('request/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get request statistics (Admin only)',
    description:
      'Retrieve comprehensive request statistics including total requests, requests per status, average request price in EUR, and percentage increase of total requests this month compared to last month.',
  })
  @ApiResponse({
    status: 200,
    description: 'Request statistics retrieved successfully',
    type: AdminRequestStatsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getRequestStats(
    @I18nLang() lang: string,
  ): Promise<AdminRequestStatsResponseDto> {
    return this.userService.getAdminRequestStats(lang);
  }

  @Get('analytics/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get analytics statistics (Admin only)',
    description:
      'Retrieve comprehensive analytics statistics including total revenue, wallet funds (available and hold), users, verified users, active requests, active trips, platform fees, and monthly percentage increases for all metrics. All amounts are in EUR.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics statistics retrieved successfully',
    type: AdminAnalyticsStatsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getAnalyticsStats(
    @I18nLang() lang: string,
  ): Promise<AdminAnalyticsStatsResponseDto> {
    return this.userService.getAdminAnalyticsStats(lang);
  }

  @Get('analytics/routes_per_volume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get routes per volume (Admin only)',
    description:
      'Retrieve trips grouped by departure country and destination country, ordered by highest count. Returns the count of trips for each route with pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Routes per volume retrieved successfully',
    type: AdminRoutesPerVolumeResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getRoutesPerVolume(
    @Query() query: AdminRoutesPerVolumeQueryDto,
    @I18nLang() lang: string,
  ): Promise<AdminRoutesPerVolumeResponseDto> {
    return this.tripService.getAdminRoutesPerVolume(query, lang);
  }

  @Get('analytics/users_ranking')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get users ranking by trip revenue (Admin only)',
    description:
      'Retrieve users ranked by trip revenue. Returns user firstname, lastname, completed trips count, success rate (percentage of requests with DELIVERED or REVIEWED status), total revenue in EUR, and average rating. Results are sorted by total revenue in descending order.',
  })
  @ApiResponse({
    status: 200,
    description: 'Users ranking retrieved successfully',
    type: AdminUsersRankingResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUsersRanking(
    @Query() query: AdminUsersRankingQueryDto,
    @I18nLang() lang: string,
  ): Promise<AdminUsersRankingResponseDto> {
    return this.userService.getAdminUsersRanking(query, lang);
  }

  @Get('analytics/payment_method_ranking')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get payment method ranking (Admin only)',
    description:
      'Retrieve transaction counts grouped by TransactionProvider (MTN, ORANGE, STRIPE) for transactions with status SEND, RECEIVED, COMPLETED, or SUCCESS. Results are ordered by highest count.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment method ranking retrieved successfully',
    type: AdminPaymentMethodRankingResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getPaymentMethodRanking(
    @I18nLang() lang: string,
  ): Promise<AdminPaymentMethodRankingResponseDto> {
    return this.paymentService.getAdminPaymentMethodRanking(lang);
  }

  @Get('analytics/package_category')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get package category statistics (Admin only)',
    description:
      'Retrieve the number of trips created with each trip item (package category). Results are ordered by highest trip count.',
  })
  @ApiResponse({
    status: 200,
    description: 'Package category statistics retrieved successfully',
    type: AdminPackageCategoryResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getPackageCategory(
    @I18nLang() lang: string,
  ): Promise<AdminPackageCategoryResponseDto> {
    return this.tripService.getAdminPackageCategory(lang);
  }

  @Get('analytics/request_status_distribution')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get request status distribution (Admin only)',
    description:
      'Retrieve the count of requests grouped by each status. Returns all request statuses with their respective counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Request status distribution retrieved successfully',
    type: AdminRequestStatusDistributionResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getRequestStatusDistribution(
    @I18nLang() lang: string,
  ): Promise<AdminRequestStatusDistributionResponseDto> {
    return this.userService.getAdminRequestStatusDistribution(lang);
  }

  @Get('analytics/users_per_country')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get users per country (Admin only)',
    description:
      'Retrieve the count of users grouped by country. Returns all countries with their respective user counts, sorted by count in descending order.',
  })
  @ApiResponse({
    status: 200,
    description: 'Users per country retrieved successfully',
    type: AdminUsersPerCountryResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getUsersPerCountry(
    @I18nLang() lang: string,
  ): Promise<AdminUsersPerCountryResponseDto> {
    return this.userService.getAdminUsersPerCountry(lang);
  }

  @Get('analytics/shipping_origins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get shipping origins (Admin only)',
    description:
      'Retrieve the count of unique users and total trips grouped by departure country. Returns all departure countries with their respective user counts and trip counts, sorted by user count in descending order.',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipping origins retrieved successfully',
    type: AdminShippingOriginsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getShippingOrigins(
    @I18nLang() lang: string,
  ): Promise<AdminShippingOriginsResponseDto> {
    return this.tripService.getAdminShippingOrigins(lang);
  }

  @Get('chats/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get chat statistics (Admin only)',
    description:
      'Retrieve comprehensive chat statistics including total chats, total messages, messages today, percentage increase of messages this month compared to last month, and total users online.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat statistics retrieved successfully',
    type: AdminChatsStatsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getChatsStats(
    @I18nLang() lang: string,
  ): Promise<AdminChatsStatsResponseDto> {
    return this.userService.getAdminChatsStats(lang);
  }

  @Get('requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all requests with filters (Admin only)',
    description:
      'Retrieve all requests with optional filters: requestId, departure (trip country or city), destination (trip country or city), from (created_at date), to (created_at date), status. Returns request information including sender, traveler, trip details, requested items, and cost in EUR.',
  })
  @ApiResponse({
    status: 200,
    description: 'Requests retrieved successfully',
    type: AdminGetRequestsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getRequests(
    @Query() query: AdminGetRequestsQueryDto,
    @I18nLang() lang: string,
  ): Promise<AdminGetRequestsResponseDto> {
    return this.userService.getAdminRequests(query, lang);
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

  @Post('users/:userId/wallet/move-hold-balance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Move money from hold balance to available balance (Admin only)',
    description:
      "Moves a specified amount from the user's hold balance to their available balance. Creates a CREDIT transaction with source ADJUSTMENT. Checks if sufficient funds are available in hold balance before processing.",
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID whose wallet balance to adjust',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: AdminMoveHoldBalanceDto,
    description: 'Amount and optional currency to move from hold to available',
    examples: {
      moveBalance: {
        summary: 'Move balance',
        value: {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          amount: 100.5,
          currency: 'EUR',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Balance moved successfully',
    type: AdminMoveHoldBalanceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Insufficient hold balance or invalid amount',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async moveHoldBalanceToAvailable(
    @Body() dto: AdminMoveHoldBalanceDto,
    @I18nLang() lang: string,
  ): Promise<AdminMoveHoldBalanceResponseDto> {
    return this.userService.moveHoldBalanceToAvailable(dto, lang);
  }

  @Get('trips/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get trip statistics (Admin only)',
    description:
      'Retrieve comprehensive trip statistics including total trips, percentage increase this month, trips in progress, trips departing within next 7 days, completed trips, and average requests per trip.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip statistics retrieved successfully',
    type: AdminTripsStatsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getTripsStats(
    @I18nLang() lang: string,
  ): Promise<AdminTripsStatsResponseDto> {
    return this.userService.getAdminTripsStats(lang);
  }

  @Get('trips')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get trips with statistics (Admin only)',
    description:
      'Retrieve all trips with optional filters. Can filter by userId, status, tripId (exact trip ID), departure (city or country), destination (city or country), searchKey (trip ID, departure city/country, destination city/country), and date range (createdAt). Returns trip information including total requests per trip and revenue per trip in EUR.',
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

  @Get('trips/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get trip by ID with comprehensive details (Admin only)',
    description:
      'Retrieve complete trip information including all trip data, earnings (on hold and withdrawable in EUR), list of users who requested the trip, and detailed request information with costs and items.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip retrieved successfully',
    type: AdminGetTripByIdResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getTripById(
    @Param('id', ParseUUIDPipe) tripId: string,
    @I18nLang() lang: string,
  ): Promise<AdminGetTripByIdResponseDto> {
    return this.tripService.getAdminTripById(tripId, lang);
  }

  @Delete('trips/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a trip (Admin only)',
    description:
      'Soft delete a trip by setting is_deleted to true. Users will not be able to see deleted trips when fetching. Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip deleted successfully',
    type: AdminDeleteTripResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async deleteTrip(
    @Param('id', ParseUUIDPipe) tripId: string,
    @I18nLang() lang: string,
  ): Promise<AdminDeleteTripResponseDto> {
    return this.tripService.adminDeleteTrip(tripId, lang);
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

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete user (Admin only)',
    description:
      'Soft delete a user account by setting is_deleted to true and changing email to deleted.{original_email}',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID to delete',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
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
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.remove(id);
  }

  @Get('requests/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get trip request details with transactions (Admin only)',
    description:
      'Retrieve complete trip request information including all request details with currency converted to EUR, and all related transactions with amounts converted to EUR. Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Request details retrieved successfully',
    type: AdminGetRequestByIdResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Trip request not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getRequestById(
    @Param('id', ParseUUIDPipe) requestId: string,
    @I18nLang() lang: string,
  ): Promise<AdminGetRequestByIdResponseDto> {
    return this.requestService.getAdminRequestById(requestId, lang);
  }

  @Patch('requests/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a trip request (Admin only)',
    description:
      'Update a trip request status or message. Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateTripRequestDto,
    description: 'Trip request update data',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip request updated successfully',
    type: UpdateTripRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 404,
    description: 'Trip request not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updateTripRequest(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() updateTripRequestDto: UpdateTripRequestDto,
    @I18nLang() lang: string,
  ): Promise<UpdateTripRequestResponseDto> {
    return this.requestService.updateTripRequest(
      requestId,
      updateTripRequestDto,
      lang,
    );
  }

  @Put('requests/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Edit a trip request (Admin only)',
    description:
      'Edit a trip request with extended fields including status, message, cost, currency, payment_status, and payment_intent_id. Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: AdminEditRequestDto,
    description: 'Trip request edit data',
  })
  @ApiResponse({
    status: 200,
    description: 'Request edited successfully',
    type: AdminEditRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 404,
    description: 'Trip request not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async editRequest(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() adminEditRequestDto: AdminEditRequestDto,
    @I18nLang() lang: string,
  ): Promise<AdminEditRequestResponseDto> {
    return this.requestService.adminEditRequest(
      requestId,
      adminEditRequestDto,
      lang,
    );
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a trip request (Admin only)',
    description:
      'Soft delete a trip request by setting is_deleted to true. Users will not be able to see deleted requests when fetching. Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Trip request ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Request deleted successfully',
    type: AdminDeleteRequestResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Trip request not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async deleteRequest(
    @Param('id', ParseUUIDPipe) requestId: string,
    @I18nLang() lang: string,
  ): Promise<AdminDeleteRequestResponseDto> {
    return this.requestService.adminDeleteRequest(requestId, lang);
  }

  @Post('requests/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refund a request (Admin only)',
    description:
      'Refund a request to either sender or traveller. Can refund full amount (100%) or partial (50%). Creates a transaction and credits the wallet. Admin access required.',
  })
  @ApiBody({
    type: AdminRefundRequestDto,
    description: 'Refund request data',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund processed successfully',
    type: AdminRefundResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or request has no cost',
  })
  @ApiResponse({
    status: 404,
    description: 'Request not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async refundRequest(
    @Body() refundDto: AdminRefundRequestDto,
    @I18nLang() lang: string,
  ): Promise<AdminRefundResponseDto> {
    return this.paymentService.refundRequest(
      refundDto.request_id,
      refundDto.destination,
      refundDto.portion,
      lang,
    );
  }

  @Get('chats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all chats (Admin only)',
    description:
      'Retrieve all chats with pagination and optional search filter. Admin can see all chats regardless of membership.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chats retrieved successfully',
    type: GetChatsResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getAllChats(
    @Query() query: GetChatsQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetChatsResponseDto> {
    return this.chatService.getAllChatsForAdmin(query, lang);
  }

  @Get('chats/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all messages of a chat (Admin only)',
    description:
      'Retrieve all messages from a specific chat with pagination. Admin can access any chat regardless of membership.',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: GetMessagesResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getChatMessages(
    @Query() query: GetMessagesQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetMessagesResponseDto> {
    return this.chatService.getChatMessagesForAdmin(query, lang);
  }

  @Post('flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Flag a message or chat (Admin only)',
    description:
      'Flag a message or chat. For messages: sets is_flagged = true on the message and increments flag_count on the sender by 1. For chats: sets is_flagged = true on the chat and increments flag_count on both chat members by 1.',
  })
  @ApiResponse({
    status: 200,
    description: 'Content flagged successfully',
    type: AdminFlagContentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters or content already flagged',
  })
  @ApiResponse({
    status: 404,
    description: 'Message or chat not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async flagContent(
    @Body() dto: AdminFlagContentDto,
    @I18nLang() lang: string,
  ): Promise<AdminFlagContentResponseDto> {
    return this.userService.flagContent(dto, lang);
  }

  @Get('chats/support/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get or create support chat with a user (Admin only)',
    description:
      'Get or create a support chat between the admin and a specific user. If no support chat exists, one will be created automatically. Returns the same format as getChats but only for the support chat.',
  })
  @ApiResponse({
    status: 200,
    description: 'Support chat retrieved successfully',
    type: GetChatsResponseDto,
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
  async getSupportChatForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() admin: User,
    @I18nLang() lang: string,
  ): Promise<GetChatsResponseDto> {
    return this.chatService.getSupportChatForAdmin(userId, admin.id, lang);
  }

  @Post('chats/warning')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send warning message to a chat (Admin only)',
    description:
      'Send a warning message of type WARNING to a chat. This works similarly to system messages sent when request status changes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Warning sent successfully',
    type: AdminSendWarningResponseDto,
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
    status: 404,
    description: 'Chat not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async sendWarning(
    @Body() dto: AdminSendWarningDto,
    @CurrentUser() admin: User,
    @I18nLang() lang: string,
  ): Promise<AdminSendWarningResponseDto> {
    const warningMessage = await this.chatService.sendWarningToChat(
      dto.chatId,
      admin.id,
      dto.message,
      lang,
    );

    return {
      message: 'Warning sent successfully',
      warningMessage,
    };
  }

  @Post('users/set-country-from-phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set user country from phone number country code (Admin only)',
    description:
      'Goes through all users without a country and sets their country based on the country code extracted from their phone number. Returns detailed results of the operation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Country update process completed',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        updated: { type: 'number' },
        failed: { type: 'number' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string', nullable: true },
              countryCode: { type: 'string', nullable: true },
              countryName: { type: 'string', nullable: true },
              status: { type: 'string', enum: ['updated', 'failed', 'skipped'] },
              error: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async setUserCountryFromPhone(
    @I18nLang() lang: string,
  ): Promise<{
    message: string;
    updated: number;
    failed: number;
    details: Array<{
      userId: string;
      email: string;
      phone: string | null;
      countryCode: string | null;
      countryName: string | null;
      status: 'updated' | 'failed' | 'skipped';
      error?: string;
    }>;
  }> {
    return this.userService.setUserCountryFromPhone(lang);
  }
}
