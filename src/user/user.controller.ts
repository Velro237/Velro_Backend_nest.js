import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  CreateReportDto,
  CreateReportResponseDto,
} from './dto/create-report.dto';
import {
  GetReportsQueryDto,
  GetReportsResponseDto,
} from './dto/get-reports.dto';
import {
  CreateRatingDto,
  CreateRatingResponseDto,
} from './dto/create-rating.dto';
import {
  GetUserRatingsQueryDto,
  GetUserRatingsResponseDto,
} from './dto/get-user-ratings.dto';
import { UserStatsResponseDto } from './dto/user-stats.dto';
import { I18nLang, I18nService } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  ApiUserWelcome,
  ApiCreateUser,
  ApiFindAllUsers,
  ApiFindOneUser,
  ApiRemoveUser,
  ApiUpdateUser,
  ApiCreateReport,
  ApiGetReports,
  ApiCreateRating,
  ApiGetUserRatings,
  ApiGetUserStats,
} from './decorators/api-docs.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';

@ApiTags('User')
@ApiBearerAuth('JWT-auth')
@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private i18n: I18nService,
  ) {}

  @Get('me')
  @ApiUserWelcome()
  async getMe(@CurrentUser() user: User, @I18nLang() lang: string) {
    const message = await this.i18n.translate('translation.hello', {
      lang,
      args: { name: user.email.split('@')[0] }, // Use email prefix as name
    });

    return {
      message,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  /* ---------------- USER ENDPOINTS ---------------- */
  @ApiCreateUser()
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @ApiFindAllUsers()
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @ApiFindOneUser()
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.userService.findOne(id);
  }

  @ApiUpdateUser()
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.update(id, dto);
  }

  @ApiRemoveUser()
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.userService.remove(id);
  }

  /* ---------------- REPORT ENDPOINTS ---------------- */
  @Post('report')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateReport()
  async createReport(
    @Body() createReportDto: CreateReportDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CreateReportResponseDto> {
    return this.userService.createReport(createReportDto, user.id, lang);
  }

  @Get('reports')
  @ApiGetReports()
  async getReports(
    @Query() query: GetReportsQueryDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetReportsResponseDto> {
    return this.userService.getReports(user.id, query, lang);
  }

  /* ---------------- RATING ENDPOINTS ---------------- */
  @Post('rating')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateRating()
  async createRating(
    @Body() createRatingDto: CreateRatingDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CreateRatingResponseDto> {
    return this.userService.createRating(createRatingDto, user.id, lang);
  }

  @Get('ratings/:user_id')
  @ApiGetUserRatings()
  async getUserRatings(
    @Param('user_id', new ParseUUIDPipe()) userId: string,
    @Query() query: GetUserRatingsQueryDto,
    @I18nLang() lang: string,
  ): Promise<GetUserRatingsResponseDto> {
    return this.userService.getUserRatings(userId, query, lang);
  }

  @Get('stats/:user_id')
  @ApiGetUserStats()
  async getUserStats(
    @Param('user_id', new ParseUUIDPipe()) userId: string,
    @I18nLang() lang: string,
  ): Promise<UserStatsResponseDto> {
    return this.userService.getUserStats(userId, lang);
  }
}
