import {
  Controller,
  Get,
  Post,
  Patch,
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
import {
  AdminChangeReportStatusDto,
  AdminChangeReportStatusResponseDto,
} from './dto/admin-change-report-status.dto';
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
import { RequestService } from '../request/request.service';
import { AdminChatsStatsResponseDto } from './dto/admin-chats-stats.dto';
import { AdminTripsStatsResponseDto } from './dto/admin-trips-stats.dto';
import {
  AdminFlagContentDto,
  AdminFlagContentResponseDto,
} from './dto/admin-flag-content.dto';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { PrismaService } from '../prisma/prisma.service';
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
}
