import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
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
import {
  SendBulkEmailDto,
  SendBulkEmailResponseDto,
} from './dto/send-bulk-email.dto';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ApiReplyReport,
  ApiAdminGetAllReports,
} from './decorators/api-docs.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
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

  @Post('send-bulk-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send bulk email to all users (Admin only)',
    description:
      "Sends an HTML email to all users in the database. The email content is personalized by replacing {user name} with the user's actual name and sent in their preferred language (English or French).",
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk emails sent successfully',
    type: SendBulkEmailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async sendBulkEmail(
    @Body() sendBulkEmailDto: SendBulkEmailDto,
    @I18nLang() lang: string,
  ): Promise<SendBulkEmailResponseDto> {
    return this.userService.sendBulkEmail(sendBulkEmailDto, lang);
  }
}
