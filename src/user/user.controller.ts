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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import {
  GetAllUsersQueryDto,
  GetAllUsersResponseDto,
} from './dto/get-all-users.dto';
import { I18nLang, I18nService } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import {
  ApiUserWelcome,
  ApiCreateUser,
  ApiFindAllUsers,
  ApiFindOneUser,
  ApiUpdateUser,
  ApiUpdateProfilePicture,
  ApiCreateReport,
  ApiGetReports,
  ApiCreateRating,
  ApiGetUserRatings,
  ApiGetUserStats,
} from './decorators/api-docs.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
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
    return this.userService.getMe(user.id, lang);
  }

  /* ---------------- USER ENDPOINTS ---------------- */
  @ApiCreateUser()
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @ApiFindAllUsers()
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll(
    @Query() query: GetAllUsersQueryDto,
  ): Promise<GetAllUsersResponseDto> {
    return this.userService.findAll(query);
  }

  @Get('email/:email')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({
    summary: 'Get users by email (Admin only)',
    description:
      'Retrieve all users (including deleted) with the given email address. Returns an array as there may be multiple users with the same email. Admin access required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No users found with this email',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async findByEmail(@Param('email') email: string) {
    return this.userService.findByEmail(email);
  }

  @ApiFindOneUser()
  @Public()
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.userService.findOne(id);
  }

  @ApiUpdateUser()
  @Patch('profile')
  update(@CurrentUser() user: User, @Body() dto: UpdateUserDto) {
    return this.userService.update(user.id, dto);
  }

  @Patch('profile/picture')
  @UseInterceptors(FileInterceptor('picture'))
  @HttpCode(HttpStatus.OK)
  @ApiUpdateProfilePicture()
  async updateProfilePicture(
    @CurrentUser() user: User,
    @UploadedFile() picture: any,
  ) {
    if (!picture) {
      throw new BadRequestException('Picture file is required');
    }
    return this.userService.updateProfilePicture(user.id, picture);
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
