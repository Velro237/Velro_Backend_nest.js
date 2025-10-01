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
import {
  AdminGetAllReportsQueryDto,
  AdminGetAllReportsResponseDto,
} from './dto/admin-get-all-reports.dto';
import { ReplyReportDto, ReplyReportResponseDto } from './dto/reply-report.dto';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
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
  constructor(private readonly userService: UserService) {}

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
}
