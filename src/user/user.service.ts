import {
  ConflictException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetMeResponseDto } from './dto/get-me.dto';
import { randomInt } from 'crypto';

import * as bcrypt from 'bcryptjs';
const userSelect = {
  id: true,
  email: true,
  username: true,
  name: true,
  firstName: true,
  lastName: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  picture: true,
  device_id: true,
  role: true,
  isFreightForwarder: true,
  companyName: true,
  companyAddress: true,
  businessType: true,
  // additionalInfo: true, // TODO: Add this field to User model in schema.prisma first
  currency: true,
  lang: true,
  date_of_birth: true,
  stripe_account_id: true,
  payout_country: true,
  payout_currency: true,
  transfers_capability: true,
  stripe_onboarding_complete: true,
  is_suspended: true,
  push_notification: true,
  email_notification: true,
  sms_notification: true,
  is_deleted: true,
  createdAt: true,
  updatedAt: true,
  services: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  cities: {
    select: {
      id: true,
      name: true,
      address: true,
      contactName: true,
      contactPhone: true,
    },
  },
  kycRecords: {
    select: {
      id: true,
      status: true,
      provider: true,
      rejectionReason: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

import {
  CreateReportDto,
  CreateReportResponseDto,
} from './dto/create-report.dto';
import {
  GetReportsQueryDto,
  GetReportsResponseDto,
} from './dto/get-reports.dto';
import { ReplyReportDto, ReplyReportResponseDto } from './dto/reply-report.dto';
import {
  AdminGetAllReportsQueryDto,
  AdminGetAllReportsResponseDto,
} from './dto/admin-get-all-reports.dto';
import { AdminReportsStatsResponseDto } from './dto/admin-reports-stats.dto';
import { AdminChangeReportStatusResponseDto } from './dto/admin-change-report-status.dto';
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
  AdminChangePasswordDto,
  AdminChangePasswordResponseDto,
} from './dto/admin-change-password.dto';
import {
  GetAllUsersQueryDto,
  GetAllUsersResponseDto,
} from './dto/get-all-users.dto';
import {
  UserRole,
  KYCStatus,
  RequestStatus,
  TripStatus,
  ReportStatus,
  TransactionSource,
} from 'generated/prisma';
import { I18nService } from 'nestjs-i18n';
import { ImageService } from '../shared/services/image.service';
import { NotificationService } from '../notification/notification.service';
import { CurrencyService } from '../currency/currency.service';
import { AdminUsersStatsResponseDto } from './dto/admin-users-stats.dto';
import {
  AdminGetAllUsersQueryDto,
  AdminGetAllUsersResponseDto,
  UserStatusFilter,
} from './dto/admin-get-all-users.dto';
import { AdminUserDetailsResponseDto } from './dto/admin-user-details.dto';
import {
  AdminUserWalletResponseDto,
  AdminUserWalletTransactionsResponseDto,
} from './dto/admin-user-wallet.dto';
import {
  PaginationQueryDto,
  DetailedTransactionDto,
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
import { AdminChatsStatsResponseDto } from './dto/admin-chats-stats.dto';
import { AdminTripsStatsResponseDto } from './dto/admin-trips-stats.dto';
import { AdminAnalyticsStatsResponseDto } from './dto/admin-analytics-stats.dto';
import {
  AdminUsersRankingQueryDto,
  AdminUsersRankingResponseDto,
} from './dto/admin-users-ranking.dto';
import { AdminRequestStatusDistributionResponseDto } from './dto/admin-request-status-distribution.dto';
import {
  AdminFlagContentDto,
  AdminFlagContentResponseDto,
} from './dto/admin-flag-content.dto';
import { RedisService } from '../redis/redis.service';
import {
  AdminMoveHoldBalanceDto,
  AdminMoveHoldBalanceResponseDto,
} from './dto/admin-move-hold-balance.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly imageService: ImageService,
    private readonly notificationService: NotificationService,
    private readonly currencyService: CurrencyService,
    private readonly walletService: WalletService,
    private readonly redisService: RedisService,
  ) {}

  async getMe(userId: string, lang: string = 'en'): Promise<GetMeResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: userSelect,
      });

      if (!user) {
        const message = await this.i18n.translate('translation.user.notFound', {
          lang,
          defaultValue: 'User not found',
        });
        throw new NotFoundException(message);
      }

      const message = await this.i18n.translate('translation.hello', {
        lang,
        args: { name: user.name || user.email.split('@')[0] },
      });

      return {
        message,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          address: user.address,
          city: user.city,
          state: user.state,
          zip: user.zip,
          picture: user.picture,
          device_id: user.device_id,
          role: user.role,
          isFreightForwarder: user.isFreightForwarder,
          companyName: user.companyName,
          companyAddress: user.companyAddress,
          businessType: user.businessType,
          currency: user.currency,
          lang: user.lang,
          date_of_birth: user.date_of_birth,
          stripe_account_id: user.stripe_account_id,
          payout_country: user.payout_country,
          payout_currency: user.payout_currency,
          transfers_capability: user.transfers_capability,
          stripe_onboarding_complete: user.stripe_onboarding_complete,
          push_notification: user.push_notification,
          email_notification: user.email_notification,
          sms_notification: user.sms_notification,
          // additionalInfo: user.additionalInfo, // TODO: Add this field to User model in schema.prisma first
          services: (user.services || []).map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description || undefined,
          })),
          cities: (user.cities || []).map((c) => ({
            id: c.id,
            name: c.name,
            address: c.address,
            contactName: c.contactName,
            contactPhone: c.contactPhone,
          })),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          kycRecord: user.kycRecords?.[0] || null,
        },
      } as GetMeResponseDto;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate('translation.user.getFailed', {
        lang,
        defaultValue: 'Failed to retrieve user information',
      });
      throw new InternalServerErrorException(message);
    }
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(createUserDto: CreateUserDto) {
    const { email, password, name, picture, role } = createUserDto;

    // Check if user already exists (non-deleted users only)
    const exists = await this.prisma.user.findFirst({
      where: {
        email,
        is_deleted: false,
      },
    });
    if (exists)
      throw new ConflictException('User with this email already exists');

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;
    const otpCode = randomInt(100_000, 1_000_000);
    const otpHash = await bcrypt.hash(String(otpCode), 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        picture,
        role,
        otpCode: otpHash,
        last_seen: new Date(), // Set last_seen on user creation
      },
      select: userSelect,
    });

    return user;
  }

  async findAll(query?: GetAllUsersQueryDto): Promise<GetAllUsersResponseDto> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: userSelect,
        skip,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException(`User #${id} not found`);

    // Calculate statistics in parallel
    const [ratings, tripsCount, requestsCount] = await Promise.all([
      // Get all ratings received by this user
      this.prisma.rating.findMany({
        where: { receiver_id: id },
        select: { rating: true },
      }),
      // Count trips created by this user
      this.prisma.trip.count({
        where: { user_id: id },
      }),
      // Count requests made by this user
      this.prisma.tripRequest.count({
        where: { user_id: id },
      }),
    ]);

    // Calculate average rating
    const totalRatings = ratings.length;
    const averageRating =
      totalRatings > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
        : 0;

    return {
      ...user,
      averageRating: Number(averageRating.toFixed(2)),
      totalRatings,
      totalTrips: tripsCount,
      totalRequests: requestsCount,
    };
  }

  async findByEmail(email: string) {
    const users = await this.prisma.user.findMany({
      where: {
        email,
      },
      select: userSelect,
      orderBy: {
        createdAt: 'desc', // Return most recently created users first
      },
    });
    if (!users || users.length === 0)
      throw new NotFoundException(`User with email ${email} not found`);

    // Get all user IDs for batch queries
    const userIds = users.map((u) => u.id);

    // Batch queries for aggregations
    const [allRatings, tripCounts, requestCounts] = await Promise.all([
      // Get all ratings received by these users
      this.prisma.rating.findMany({
        where: { receiver_id: { in: userIds } },
        select: { receiver_id: true, rating: true },
      }),
      // Count trips created by these users
      this.prisma.trip.groupBy({
        by: ['user_id'],
        where: { user_id: { in: userIds } },
        _count: { id: true },
      }),
      // Count requests made by these users
      this.prisma.tripRequest.groupBy({
        by: ['user_id'],
        where: { user_id: { in: userIds } },
        _count: { id: true },
      }),
    ]);

    // Create maps for quick lookup
    const ratingMap = new Map<string, number[]>();
    allRatings.forEach((rating) => {
      const existing = ratingMap.get(rating.receiver_id) || [];
      existing.push(rating.rating);
      ratingMap.set(rating.receiver_id, existing);
    });

    const tripCountMap = new Map<string, number>(
      tripCounts.map((t) => [t.user_id, t._count.id] as [string, number]),
    );
    const requestCountMap = new Map<string, number>(
      requestCounts.map((r) => [r.user_id, r._count.id] as [string, number]),
    );

    // Build response array with statistics for each user
    const userDtos = users.map((user) => {
      const ratings = ratingMap.get(user.id) || [];
      const totalRatings = ratings.length;
      const averageRating =
        totalRatings > 0
          ? ratings.reduce((sum, r) => sum + r, 0) / totalRatings
          : 0;

      return {
        ...user,
        averageRating: Number(averageRating.toFixed(2)),
        totalRatings,
        totalTrips: tripCountMap.get(user.id) ?? 0,
        totalRequests: requestCountMap.get(user.id) ?? 0,
      };
    });

    return userDtos;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // Helper function to trim string values (except password and special fields)
    const trimValue = (key: string, value: any): any => {
      // Don't trim password, date_of_birth, or non-string values
      if (
        key === 'password' ||
        key === 'date_of_birth' ||
        typeof value !== 'string'
      ) {
        return value;
      }
      // Trim and return undefined if empty (for optional fields)
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    };

    // Trim all string fields in the DTO
    const trimmedDto: any = {};
    for (const [key, value] of Object.entries(updateUserDto)) {
      if (key === 'email' && typeof value === 'string') {
        // Special handling for email: trim and lowercase
        const trimmed = value.trim().toLowerCase();
        trimmedDto[key] = trimmed === '' ? undefined : trimmed;
      } else if (key === 'services' && Array.isArray(value)) {
        // Trim service fields
        trimmedDto[key] = value.map((service: any) => ({
          ...service,
          name: service.name?.trim() || undefined,
          description: service.description?.trim() || undefined,
        }));
      } else if (key === 'cities' && Array.isArray(value)) {
        // Trim city fields
        trimmedDto[key] = value.map((city: any) => ({
          ...city,
          name: city.name?.trim() || undefined,
          address: city.address?.trim() || undefined,
          contactName: city.contactName?.trim() || undefined,
          contactPhone: city.contactPhone?.trim() || undefined,
        }));
      } else {
        trimmedDto[key] = trimValue(key, value);
      }
    }

    const { email, password, date_of_birth, services, cities, ...rest } =
      trimmedDto;

    // Validate that firstName, lastName, and username cannot be set to null or empty
    if (
      'firstName' in rest &&
      (rest.firstName === null || rest.firstName === '')
    ) {
      throw new ConflictException('First name cannot be null or empty');
    }
    if (
      'lastName' in rest &&
      (rest.lastName === null || rest.lastName === '')
    ) {
      throw new ConflictException('Last name cannot be null or empty');
    }
    if (
      'username' in rest &&
      (rest.username === null || rest.username === '')
    ) {
      throw new ConflictException('Username cannot be null or empty');
    }

    // Validate email uniqueness with trimmed email (non-deleted users only)
    if (email) {
      const dup = await this.prisma.user.findFirst({
        where: {
          email,
          is_deleted: false,
        },
      });
      if (dup && dup.id !== id)
        throw new ConflictException('User with this email already exists');
    }

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;

    // Convert date_of_birth string to DateTime if provided (already trimmed)
    const dateOfBirth = date_of_birth ? new Date(date_of_birth) : undefined;

    try {
      // Handle services and cities updates in a transaction
      return await this.prisma.$transaction(async (prisma) => {
        // Handle services (similar to cities)
        let servicesData: any = undefined;
        if (services !== undefined) {
          // Get existing services for this user (via the many-to-many relation)
          const user = await prisma.user.findUnique({
            where: { id },
            include: { services: { select: { id: true } } },
          });

          if (!user) {
            throw new NotFoundException(`User #${id} not found`);
          }

          const serviceIdsFromRequest = new Set<string>();

          for (const service of services) {
            if (service.id) {
              // Connect to existing service (validate it exists)
              const existingService = await prisma.companyService.findUnique({
                where: { id: service.id },
                select: { id: true },
              });

              if (!existingService) {
                throw new NotFoundException(
                  `Service with ID ${service.id} not found`,
                );
              }

              serviceIdsFromRequest.add(service.id);

              // Update service details if provided
              await prisma.companyService.update({
                where: { id: service.id },
                data: {
                  name: service.name.trim(),
                  ...(service.description !== undefined
                    ? { description: service.description.trim() || null }
                    : {}),
                },
              });
            } else {
              // Create new service
              const newService = await prisma.companyService.create({
                data: {
                  name: service.name.trim(),
                  description: service.description
                    ? service.description.trim()
                    : null,
                },
              });
              serviceIdsFromRequest.add(newService.id);
            }
          }

          // Disconnect services not in the request (but don't delete them as they're shared)
          // The Prisma set operation will handle disconnection automatically

          // Prepare services connection data
          servicesData = {
            set: Array.from(serviceIdsFromRequest).map((serviceId) => ({
              id: serviceId,
            })),
          };
        }

        // Prepare cities data
        let citiesData: any = undefined;
        if (cities !== undefined) {
          // Get existing cities for this user
          const existingCities = await prisma.companyCity.findMany({
            where: { userId: id },
            select: { id: true },
          });
          const existingCityIds = new Set(existingCities.map((c) => c.id));

          // Validate that all provided city IDs belong to this user
          const cityIdsToUpdate = cities
            .map((c) => c.id)
            .filter((id): id is string => !!id);
          if (cityIdsToUpdate.length > 0) {
            const invalidCityIds = cityIdsToUpdate.filter(
              (cityId) => !existingCityIds.has(cityId),
            );
            if (invalidCityIds.length > 0) {
              throw new NotFoundException(
                `One or more city IDs not found or do not belong to this user: ${invalidCityIds.join(', ')}`,
              );
            }
          }

          // Separate cities to create, update, and delete
          const citiesToUpdate: string[] = [];
          const citiesToCreate: any[] = [];
          const cityIdsFromRequest = new Set<string>();

          for (const city of cities) {
            if (city.id) {
              // Update existing city
              cityIdsFromRequest.add(city.id);
              citiesToUpdate.push(city.id);
              await prisma.companyCity.update({
                where: { id: city.id },
                data: {
                  name: city.name.trim(),
                  address: city.address.trim(),
                  contactName: city.contactName.trim(),
                  contactPhone: city.contactPhone.trim(),
                  userId: id,
                },
              });
            } else {
              // Create new city
              citiesToCreate.push({
                name: city.name.trim(),
                address: city.address.trim(),
                contactName: city.contactName.trim(),
                contactPhone: city.contactPhone.trim(),
                userId: id,
              });
            }
          }

          // Delete cities that are not in the request
          const citiesToDelete = existingCities
            .map((c) => c.id)
            .filter((id) => !cityIdsFromRequest.has(id));

          if (citiesToDelete.length > 0) {
            await prisma.companyCity.deleteMany({
              where: {
                id: { in: citiesToDelete },
                userId: id,
              },
            });
          }

          // Create new cities
          if (citiesToCreate.length > 0) {
            await prisma.companyCity.createMany({
              data: citiesToCreate,
            });
          }

          // For the relation update, we'll use connect to existing and newly created cities
          // Get all current cities after update
          const allCities = await prisma.companyCity.findMany({
            where: { userId: id },
            select: { id: true },
          });
          citiesData = {
            set: allCities.map((c) => ({ id: c.id })),
          };
        }

        // Filter out null values for firstName, lastName, and username to prevent setting them to null
        const updateData: any = {
          ...rest,
          ...(email ? { email } : {}),
          ...(hashed ? { password: hashed } : {}),
          ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
          ...(servicesData ? { services: servicesData } : {}),
          ...(citiesData ? { cities: citiesData } : {}),
        };

        // Remove null values for required fields (they should not be updated to null)
        if (updateData.firstName === null) delete updateData.firstName;
        if (updateData.lastName === null) delete updateData.lastName;
        if (updateData.username === null) delete updateData.username;

        // Update user with all fields
        return await prisma.user.update({
          where: { id },
          data: updateData,
          select: userSelect,
        });
      });
    } catch (e) {
      // NotFound → throw
      const exists = await this.prisma.user.findUnique({ where: { id } });
      if (!exists) throw new NotFoundException(`User #${id} not found`);
      throw e;
    }
  }

  /**
   * Update user profile picture
   * @param id - User ID
   * @param picture - Multer file for profile picture
   * @returns Updated user with new picture URL
   */
  async updateProfilePicture(
    id: string,
    picture: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    },
  ) {
    // Get current user to check for existing picture
    const currentUser = await this.prisma.user.findUnique({
      where: { id },
      select: { picture: true },
    });

    if (!currentUser) {
      throw new NotFoundException(`User #${id} not found`);
    }

    try {
      // Upload new picture to Cloudinary
      const uploadResult = await this.imageService.uploadFile(picture, {
        folder: 'users',
        alt_text: `Profile picture for user ${id}`,
        object_id: id,
      });

      const newPictureUrl = uploadResult.image.url;

      // Delete old picture from Cloudinary if it exists
      if (currentUser.picture) {
        try {
          // Extract public_id from Cloudinary URL
          // Cloudinary URLs format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
          const urlParts = currentUser.picture.split('/');
          const uploadIndex = urlParts.findIndex((part) => part === 'upload');

          if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
            // Extract public_id (everything after 'upload/' and before the file extension)
            const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
            const publicId = pathAfterUpload.replace(/\.[^/.]+$/, ''); // Remove file extension

            // Delete from Cloudinary
            await this.imageService.deleteImageByPublicId(publicId);
          }
        } catch (deleteError: any) {
          // Log error but don't fail the update if deletion fails
          console.warn(
            `Failed to delete old picture from Cloudinary: ${deleteError.message}`,
          );
        }
      }

      // Update user with new picture URL
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: { picture: newPictureUrl },
        select: userSelect,
      });

      return updatedUser;
    } catch (uploadError: any) {
      throw new InternalServerErrorException(
        `Failed to upload picture: ${uploadError.message}`,
      );
    }
  }

  async remove(id: string) {
    try {
      // First get the user's current email
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
        select: { email: true },
      });

      if (!existingUser) {
        throw new NotFoundException(`User #${id} not found`);
      }

      // Soft delete: set is_deleted to true and change email to deleted.{original_email}
      const newEmail = existingUser.email.startsWith('deleted.')
        ? existingUser.email // If already prefixed with deleted., keep it as is
        : `deleted.${existingUser.email}`;

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          is_deleted: true,
          email: newEmail,
        },
        select: userSelect,
      });
      return user;
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      const exists = await this.prisma.user.findUnique({ where: { id } });
      if (!exists) throw new NotFoundException(`User #${id} not found`);
      throw e;
    }
  }

  async createReport(
    createReportDto: CreateReportDto,
    userId: string,
    lang?: string,
  ): Promise<CreateReportResponseDto> {
    const {
      reported_id,
      reply_to_id,
      trip_id,
      request_id,
      type,
      text,
      priority,
      data,
      images,
    } = createReportDto;

    try {
      // Validate that the reported user exists
      const reportedUser = await this.prisma.user.findUnique({
        where: { id: reported_id },
      });

      if (!reportedUser) {
        const message = await this.i18n.translate(
          'translation.report.userNotFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Validate that the trip exists and get trip details
      const trip = await this.prisma.trip.findUnique({
        where: { id: trip_id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!trip) {
        const message = await this.i18n.translate(
          'translation.report.tripNotFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // If request_id is provided, validate that the request exists
      if (request_id) {
        const request = await this.prisma.tripRequest.findUnique({
          where: { id: request_id },
        });

        if (!request) {
          const message = await this.i18n.translate(
            'translation.report.requestNotFound',
            { lang },
          );
          throw new NotFoundException(message);
        }
      }

      // If reply_to_id is provided, validate that the report exists
      if (reply_to_id) {
        const replyToReport = await this.prisma.report.findUnique({
          where: { id: reply_to_id },
        });

        if (!replyToReport) {
          const message = await this.i18n.translate(
            'translation.report.reportNotFound',
            { lang },
          );
          throw new NotFoundException(message);
        }
      }

      // Prevent self-reporting (cannot report yourself as the reported user)
      // Users can create reports for trips they created, but they cannot report themselves
      // if (userId === reported_id) {
      //   const message = await this.i18n.translate(
      //     'translation.report.cannotReportSelf',
      //     { lang },
      //   );
      //   throw new ConflictException(message);
      // }

      // Create the report
      const report = await this.prisma.report.create({
        data: {
          user_id: userId,
          reported_id,
          reply_to_id: reply_to_id || null,
          trip_id,
          request_id: request_id || null,
          type,
          text: text || null,
          priority,
          data: data || null,
          images: images || null,
        },
      });

      const message = await this.i18n.translate(
        'translation.report.createSuccess',
        { lang },
      );

      return {
        message,
        report: {
          id: report.id,
          user_id: report.user_id,
          reported_id: report.reported_id,
          trip_id: report.trip_id,
          type: report.type,
          priority: report.priority,
          status: report.status,
          created_at: report.created_at,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      const message = await this.i18n.translate(
        'translation.report.createFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getReports(
    userId: string,
    query: GetReportsQueryDto,
    lang?: string,
  ): Promise<GetReportsResponseDto> {
    const { page = 1, limit = 10, type, priority, status, trip_id } = query;

    const skip = (page - 1) * limit;

    try {
      // Build where clause
      const whereClause: any = {
        user_id: userId, // Only get reports submitted by this user
      };

      // Add filters if provided
      if (type) {
        whereClause.type = type;
      }

      if (priority) {
        whereClause.priority = priority;
      }

      if (status) {
        whereClause.status = status;
      }

      if (trip_id) {
        whereClause.trip_id = trip_id;
      }

      // Get reports with pagination
      const [reports, total] = await Promise.all([
        this.prisma.report.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
            reported: {
              select: {
                id: true,
                email: true,
              },
            },
            trip: {
              select: {
                id: true,
                pickup: true,
                destination: true,
                departure_date: true,
              },
            },
            request: {
              select: {
                id: true,
                status: true,
                message: true,
                created_at: true,
                updated_at: true,
              },
            },
            replier: {
              select: {
                id: true,
                email: true,
              },
            },
            _count: {
              select: {
                replies: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.report.count({
          where: whereClause,
        }),
      ]);

      // Transform reports to response format
      const reportSummaries = reports.map((report) => ({
        id: report.id,
        reporter_user: {
          id: report.user.id,
          email: report.user.email,
        },
        reported_user: {
          id: report.reported.id,
          email: report.reported.email,
        },
        trip: {
          id: report.trip.id,
          pickup: report.trip.pickup,
          destination: report.trip.destination,
          departure_date: report.trip.departure_date,
        },
        request: report.request
          ? {
              id: report.request.id,
              status: report.request.status,
              message: report.request.message,
              created_at: report.request.created_at,
              updated_at: report.request.updated_at,
            }
          : undefined,
        type: report.type,
        priority: report.priority,
        status: report.status,
        text: report.text,
        data: report.data as Record<string, any> | undefined,
        images: report.images as Record<string, any> | undefined,
        replied_by: report.replier
          ? {
              id: report.replier.id,
              email: report.replier.email,
            }
          : undefined,
        replies_count: report._count.replies,
        created_at: report.created_at,
        updated_at: report.updated_at,
      }));

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.report.getSuccess',
        { lang },
      );

      return {
        message,
        reports: reportSummaries,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.report.getFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Change report status (Admin only)
   */
  async changeReportStatus(
    reportId: string,
    status: ReportStatus,
    lang?: string,
  ): Promise<AdminChangeReportStatusResponseDto> {
    try {
      // Find the report
      const report = await this.prisma.report.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          status: true,
          reply_to_id: true,
        },
      });

      if (!report) {
        const message = await this.i18n.translate(
          'translation.report.notFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Only allow changing status of original reports, not replies
      if (report.reply_to_id) {
        const message = await this.i18n.translate(
          'translation.report.cannotChangeReplyStatus',
          {
            lang,
            defaultValue:
              'Cannot change status of reply reports. Only original reports can have their status changed.',
          },
        );
        throw new BadRequestException(message);
      }

      // Update the report status
      const updatedReport = await this.prisma.report.update({
        where: { id: reportId },
        data: { status },
        select: {
          id: true,
          status: true,
          updated_at: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.report.statusUpdated',
        {
          lang,
          defaultValue: 'Report status updated successfully',
        },
      );

      return {
        message,
        report: {
          id: updatedReport.id,
          status: updatedReport.status,
          updated_at: updatedReport.updated_at,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const message = await this.i18n.translate(
        'translation.report.statusUpdateFailed',
        {
          lang,
          defaultValue: 'Failed to update report status',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async replyToReport(
    replyReportDto: ReplyReportDto,
    adminId: string,
    lang?: string,
  ): Promise<ReplyReportResponseDto> {
    const { report_id, text, priority, data, images } = replyReportDto;

    try {
      // Find the original report
      const originalReport = await this.prisma.report.findUnique({
        where: { id: report_id },
        include: {
          user: {
            select: { id: true, email: true },
          },
          trip: {
            select: { id: true },
          },
        },
      });

      if (!originalReport) {
        const message = await this.i18n.translate(
          'translation.report.notFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Create the reply report
      const replyReport = await this.prisma.report.create({
        data: {
          user_id: originalReport.user_id, // Original reporter (maintain the same user_id)
          reported_id: originalReport.reported_id, // Same reported user as original
          reply_to_id: report_id, // Original report being replied to
          trip_id: originalReport.trip_id,
          request_id: originalReport.request_id,
          type: 'RESPONSE_TO_REPORT', // Admin response type
          text,
          priority,
          data: data || null,
          images: images || null,
          replied_by: adminId, // Admin who replied
          status: 'REPLIED', // Reply reports are automatically marked as replied
        },
      });

      // Update the original report status to REPLIED
      await this.prisma.report.update({
        where: { id: report_id },
        data: { status: 'REPLIED' },
      });

      const message = await this.i18n.translate(
        'translation.report.replySuccess',
        { lang },
      );

      return {
        message,
        reply: {
          id: replyReport.id,
          user_id: replyReport.user_id,
          reported_id: replyReport.reported_id,
          reply_to_id: replyReport.reply_to_id,
          trip_id: replyReport.trip_id,
          type: replyReport.type,
          priority: replyReport.priority,
          status: replyReport.status,
          created_at: replyReport.created_at,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const message = await this.i18n.translate(
        'translation.report.replyFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get report statistics for admin
   */
  async getAdminReportsStats(
    lang?: string,
  ): Promise<AdminReportsStatsResponseDto> {
    try {
      // Get current date boundaries
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const startOfLastMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
      );

      // Get total reports
      const totalReports = await this.prisma.report.count({
        where: {
          reply_to_id: null, // Only count original reports, not replies
        },
      });

      // Get reports grouped by status (only original reports, not replies)
      const reportsByStatus = await this.prisma.report.groupBy({
        by: ['status'],
        where: {
          reply_to_id: null,
        },
        _count: {
          id: true,
        },
      });

      // Build status map
      const statusMap = new Map<string, number>();
      reportsByStatus.forEach((item) => {
        statusMap.set(item.status, item._count.id);
      });

      // Get total replied this month (original reports that have a reply created this month)
      const originalReportsWithRepliesThisMonth =
        await this.prisma.report.findMany({
          where: {
            reply_to_id: null, // Only original reports
            status: 'REPLIED',
            replies: {
              some: {
                created_at: {
                  gte: startOfThisMonth,
                },
              },
            },
          },
          select: {
            id: true,
          },
        });
      const totalRepliedThisMonth = originalReportsWithRepliesThisMonth.length;

      // Get all original reports with status REPLIED and their first reply
      const repliedReports = await this.prisma.report.findMany({
        where: {
          status: 'REPLIED',
          reply_to_id: null, // Only original reports
        },
        include: {
          replies: {
            orderBy: {
              created_at: 'asc',
            },
            take: 1,
            select: {
              created_at: true,
            },
          },
        },
      });

      // Calculate reply times (in milliseconds)
      const replyTimes: number[] = [];
      const replyTimesThisMonth: number[] = [];
      const replyTimesLastMonth: number[] = [];

      repliedReports.forEach((report) => {
        const firstReply = report.replies[0];
        if (firstReply) {
          const replyTime =
            firstReply.created_at.getTime() - report.created_at.getTime();

          // Only include positive reply times (should always be positive)
          if (replyTime > 0) {
            replyTimes.push(replyTime);

            // Check if reply was created this month
            if (firstReply.created_at >= startOfThisMonth) {
              replyTimesThisMonth.push(replyTime);
            }

            // Check if reply was created last month
            if (
              firstReply.created_at >= startOfLastMonth &&
              firstReply.created_at <= startOfLastMonthEnd
            ) {
              replyTimesLastMonth.push(replyTime);
            }
          }
        }
      });

      // Calculate average reply times
      const averageReplyTime =
        replyTimes.length > 0
          ? replyTimes.reduce((sum, time) => sum + time, 0) / replyTimes.length
          : 0;

      const averageReplyTimeThisMonth =
        replyTimesThisMonth.length > 0
          ? replyTimesThisMonth.reduce((sum, time) => sum + time, 0) /
            replyTimesThisMonth.length
          : 0;

      const averageReplyTimeLastMonth =
        replyTimesLastMonth.length > 0
          ? replyTimesLastMonth.reduce((sum, time) => sum + time, 0) /
            replyTimesLastMonth.length
          : 0;

      // Calculate percentage increase
      let percentageIncreaseReplyTime = 0;
      if (averageReplyTimeLastMonth > 0) {
        percentageIncreaseReplyTime =
          ((averageReplyTimeThisMonth - averageReplyTimeLastMonth) /
            averageReplyTimeLastMonth) *
          100;
      } else if (averageReplyTimeThisMonth > 0) {
        // If last month had no replies but this month does, it's a 100% increase
        percentageIncreaseReplyTime = 100;
      }

      const message = await this.i18n.translate(
        'translation.admin.reportsStatsSuccess',
        {
          lang,
          defaultValue: 'Report statistics retrieved successfully',
        },
      );

      return {
        message,
        stats: {
          totalReports,
          reportsByStatus: {
            total_report_pending: statusMap.get('PENDING') || 0,
            total_report_replied: statusMap.get('REPLIED') || 0,
            total_report_investigation: statusMap.get('INVESTIGATION') || 0,
            total_report_resolved: statusMap.get('RESOLVED') || 0,
          },
          totalRepliedThisMonth,
          averageReplyTime: Math.round(averageReplyTime),
          averageReplyTimeThisMonth: Math.round(averageReplyTimeThisMonth),
          averageReplyTimeLastMonth: Math.round(averageReplyTimeLastMonth),
          percentageIncreaseReplyTime:
            Math.round(percentageIncreaseReplyTime * 100) / 100,
        },
      };
    } catch (error) {
      console.error('Error getting admin reports statistics:', error);
      const message = await this.i18n.translate(
        'translation.admin.reportsStatsFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve report statistics',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getAllReports(
    query: AdminGetAllReportsQueryDto,
    lang?: string,
  ): Promise<AdminGetAllReportsResponseDto> {
    const {
      page = 1,
      limit = 10,
      type,
      priority,
      status,
      trip_id,
      user_id,
      replied_by,
      start_date,
      end_date,
      searchKey,
    } = query;

    const skip = (page - 1) * limit;

    try {
      // Build where clause with all filters
      const whereClause: any = {};

      // Add filters if provided
      if (type) {
        whereClause.type = type;
      }
      if (priority) {
        whereClause.priority = priority;
      }
      if (status) {
        whereClause.status = status;
      }
      if (trip_id) {
        whereClause.trip_id = trip_id;
      }
      if (user_id) {
        whereClause.OR = [
          { user_id: user_id }, // Reporter
          { reported_id: user_id }, // Reported user
        ];
      }
      if (replied_by) {
        whereClause.replied_by = replied_by;
      }
      if (start_date || end_date) {
        whereClause.created_at = {};
        if (start_date) {
          whereClause.created_at.gte = new Date(start_date);
        }
        if (end_date) {
          whereClause.created_at.lte = new Date(end_date);
        }
      }

      // Add searchKey filter if provided
      if (searchKey) {
        const searchConditions: any[] = [
          { id: { contains: searchKey, mode: 'insensitive' } },
        ];

        // Search in reporter firstname and lastname
        searchConditions.push({
          user: {
            OR: [
              { firstName: { contains: searchKey, mode: 'insensitive' } },
              { lastName: { contains: searchKey, mode: 'insensitive' } },
            ],
          },
        });

        // Search in reported firstname and lastname
        searchConditions.push({
          reported: {
            OR: [
              { firstName: { contains: searchKey, mode: 'insensitive' } },
              { lastName: { contains: searchKey, mode: 'insensitive' } },
            ],
          },
        });

        // Combine with existing OR conditions if any
        if (whereClause.OR) {
          whereClause.AND = [{ OR: whereClause.OR }, { OR: searchConditions }];
          delete whereClause.OR;
        } else {
          whereClause.OR = searchConditions;
        }
      }

      // Get reports with pagination
      const [reports, total] = await Promise.all([
        this.prisma.report.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                kycRecords: {
                  select: {
                    id: true,
                    status: true,
                    provider: true,
                    rejectionReason: true,
                    createdAt: true,
                    updatedAt: true,
                    verifiedAt: true,
                  },
                  take: 1,
                  orderBy: {
                    updatedAt: 'desc',
                  },
                },
              },
            },
            reported: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                kycRecords: {
                  select: {
                    id: true,
                    status: true,
                    provider: true,
                    rejectionReason: true,
                    createdAt: true,
                    updatedAt: true,
                    verifiedAt: true,
                  },
                  take: 1,
                  orderBy: {
                    updatedAt: 'desc',
                  },
                },
              },
            },
            trip: {
              select: {
                id: true,
                pickup: true,
                destination: true,
                departure_date: true,
              },
            },
            request: {
              select: {
                id: true,
                status: true,
                message: true,
                created_at: true,
                updated_at: true,
              },
            },
            replier: {
              select: {
                id: true,
                email: true,
              },
            },
            _count: {
              select: {
                replies: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.report.count({
          where: whereClause,
        }),
      ]);

      // Transform reports to response format
      const reportSummaries = reports.map((report) => ({
        id: report.id,
        reporter_user: {
          id: report.user.id,
          email: report.user.email,
          firstName: report.user.firstName,
          lastName: report.user.lastName,
          kyc:
            report.user.kycRecords && report.user.kycRecords.length > 0
              ? report.user.kycRecords[0]
              : null,
        },
        reported_user: {
          id: report.reported.id,
          email: report.reported.email,
          firstName: report.reported.firstName,
          lastName: report.reported.lastName,
          kyc:
            report.reported.kycRecords && report.reported.kycRecords.length > 0
              ? report.reported.kycRecords[0]
              : null,
        },
        trip: {
          id: report.trip.id,
          pickup: report.trip.pickup,
          destination: report.trip.destination,
          departure_date: report.trip.departure_date,
        },
        request: report.request
          ? {
              id: report.request.id,
              status: report.request.status,
              message: report.request.message,
              created_at: report.request.created_at,
              updated_at: report.request.updated_at,
            }
          : undefined,
        type: report.type,
        priority: report.priority,
        status: report.status,
        text: report.text,
        data: report.data as Record<string, any> | undefined,
        images: report.images as Record<string, any> | undefined,
        replied_by: report.replier
          ? {
              id: report.replier.id,
              email: report.replier.email,
            }
          : undefined,
        replies_count: report._count.replies,
        created_at: report.created_at,
        updated_at: report.updated_at,
      }));

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.report.getAllSuccess',
        { lang },
      );

      return {
        message,
        reports: reportSummaries,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.log(error);
      const message = await this.i18n.translate(
        'translation.report.getAllFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async createRating(
    createRatingDto: CreateRatingDto,
    giverId: string,
    lang: string,
  ): Promise<CreateRatingResponseDto> {
    try {
      const { receiver_id, trip_id, request_id, rating, comment } =
        createRatingDto;

      // Validate that the receiver exists
      const receiver = await this.prisma.user.findUnique({
        where: { id: receiver_id },
      });
      if (!receiver) {
        const message = await this.i18n.translate(
          'translation.rating.receiverNotFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Validate that the trip exists
      const trip = await this.prisma.trip.findUnique({
        where: { id: trip_id },
      });
      if (!trip) {
        const message = await this.i18n.translate(
          'translation.rating.tripNotFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Validate that the request exists (if provided)
      if (request_id) {
        const request = await this.prisma.tripRequest.findUnique({
          where: { id: request_id },
        });
        if (!request) {
          const message = await this.i18n.translate(
            'translation.rating.requestNotFound',
            { lang },
          );
          throw new NotFoundException(message);
        }
      }

      // Prevent self-rating
      if (giverId === receiver_id) {
        const message = await this.i18n.translate(
          'translation.rating.cannotRateSelf',
          { lang },
        );
        throw new ConflictException(message);
      }

      // Check if rating already exists for this trip
      const existingRating = await this.prisma.rating.findUnique({
        where: {
          giver_id_receiver_id_trip_id: {
            giver_id: giverId,
            receiver_id,
            trip_id,
          },
        },
      });

      if (existingRating) {
        const message = await this.i18n.translate(
          'translation.rating.alreadyRated',
          { lang },
        );
        throw new ConflictException(message);
      }

      // Create the rating
      const newRating = await this.prisma.rating.create({
        data: {
          giver_id: giverId,
          receiver_id,
          trip_id,
          request_id,
          rating,
          comment,
        },
      });

      const message = await this.i18n.translate(
        'translation.rating.createdSuccessfully',
        { lang },
      );

      return {
        message,
        rating: {
          id: newRating.id,
          giver_id: newRating.giver_id,
          receiver_id: newRating.receiver_id,
          trip_id: newRating.trip_id,
          request_id: newRating.request_id,
          rating: newRating.rating,
          comment: newRating.comment,
          created_at: newRating.created_at,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.rating.createFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getUserRatings(
    userId: string,
    query: GetUserRatingsQueryDto,
    lang: string,
  ): Promise<GetUserRatingsResponseDto> {
    try {
      const { page = 1, limit = 10, rating, trip_id } = query;
      const skip = (page - 1) * limit;

      // Validate that the user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        const message = await this.i18n.translate(
          'translation.rating.userNotFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Build where clause for filtering
      const whereClause: any = {
        receiver_id: userId, // Get ratings received by this user
      };

      if (rating) {
        whereClause.rating = rating;
      }

      if (trip_id) {
        whereClause.trip_id = trip_id;
      }

      // Get ratings with pagination
      const [ratings, total] = await Promise.all([
        this.prisma.rating.findMany({
          where: whereClause,
          include: {
            giver: {
              select: {
                id: true,
                email: true,
                name: true,
                kycRecords: {
                  select: {
                    id: true,
                    status: true,
                    provider: true,
                    rejectionReason: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
            trip: {
              select: {
                id: true,
                pickup: true,
                destination: true,
                departure_date: true,
              },
            },
            request: {
              select: {
                id: true,
                status: true,
                message: true,
                created_at: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.rating.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Map ratings to response format
      const ratingSummaries = ratings.map((rating) => ({
        id: rating.id,
        giver: {
          id: rating.giver.id,
          email: rating.giver.email,
          name: rating.giver.name,
          kycRecords: rating.giver.kycRecords || [],
        },
        trip: {
          id: rating.trip.id,
          pickup: rating.trip.pickup as Record<string, any>,
          destination: rating.trip.destination as Record<string, any>,
          departure_date: rating.trip.departure_date,
        },
        request: rating.request
          ? {
              id: rating.request.id,
              status: rating.request.status,
              message: rating.request.message,
              created_at: rating.request.created_at,
            }
          : null,
        rating: rating.rating,
        comment: rating.comment,
        created_at: rating.created_at,
      }));

      // Calculate rating counts for all ratings received by this user (not just current page)
      const allRatings = await this.prisma.rating.findMany({
        where: {
          receiver_id: userId,
          ...(rating ? { rating } : {}),
          ...(trip_id ? { trip_id } : {}),
        },
        select: {
          rating: true,
        },
      });

      // Group ratings by value and count them
      const ratingCountMap = new Map<number, number>();
      allRatings.forEach((r) => {
        const currentCount = ratingCountMap.get(r.rating) || 0;
        ratingCountMap.set(r.rating, currentCount + 1);
      });

      // Convert to array and sort by rating value
      const ratings_count = Array.from(ratingCountMap.entries())
        .map(([rating, count]) => ({
          rating,
          count,
        }))
        .sort((a, b) => a.rating - b.rating);

      const message = await this.i18n.translate(
        'translation.rating.getUserRatingsSuccess',
        { lang },
      );

      return {
        message,
        ratings: ratingSummaries,
        ratings_count,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.rating.getUserRatingsFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getUserStats(
    userId: string,
    lang: string,
  ): Promise<UserStatsResponseDto> {
    try {
      // Validate that the user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        const message = await this.i18n.translate(
          'translation.stats.userNotFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Get all statistics in parallel
      const [totalTripsCreated, ratingsData, requestsData] = await Promise.all([
        // Total trips created by the user
        this.prisma.trip.count({
          where: { user_id: userId },
        }),

        // Ratings received by the user
        this.prisma.rating.aggregate({
          where: { receiver_id: userId },
          _avg: { rating: true },
          _count: { rating: true },
        }),

        // Requests on user's trips
        this.prisma.tripRequest.findMany({
          where: {
            trip: { user_id: userId },
          },
          select: {
            status: true,
          },
        }),
      ]);

      // Calculate success rate
      const totalRequests = requestsData.length;
      const acceptedRequests = requestsData.filter(
        (request) => request.status === 'ACCEPTED',
      ).length;

      const successRate =
        totalRequests > 0
          ? Math.round((acceptedRequests / totalRequests) * 100 * 100) / 100 // Round to 2 decimal places
          : 0;

      // Get average rating
      const averageRating = ratingsData._avg.rating
        ? Math.round(ratingsData._avg.rating * 100) / 100 // Round to 2 decimal places
        : 0;

      const totalRatings = ratingsData._count.rating || 0;

      const message = await this.i18n.translate(
        'translation.stats.getUserStatsSuccess',
        { lang },
      );

      return {
        message,
        stats: {
          totalTripsCreated,
          averageRating,
          totalRatings,
          successRate,
          totalRequests,
          acceptedRequests,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.stats.getUserStatsFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Admin method to change user password by email
   */
  async adminChangePassword(
    adminChangePasswordDto: AdminChangePasswordDto,
    lang?: string,
  ): Promise<AdminChangePasswordResponseDto> {
    try {
      const { email, password } = adminChangePasswordDto;

      // Find user by email (non-deleted users only)
      const user = await this.prisma.user.findFirst({
        where: {
          email,
          is_deleted: false,
        },
        select: { id: true, email: true },
      });

      if (!user) {
        const message = await this.i18n.translate('translation.user.notFound', {
          lang,
          defaultValue: 'User not found',
        });
        throw new NotFoundException(message);
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      const message = await this.i18n.translate(
        'translation.user.admin.passwordChanged',
        {
          lang,
          defaultValue: 'Password changed successfully',
        },
      );

      return {
        message,
        userId: user.id,
        email: user.email,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error changing user password:', error);
      const message = await this.i18n.translate(
        'translation.user.admin.passwordChangeFailed',
        {
          lang,
          defaultValue: 'Failed to change password',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get user statistics for admin dashboard
   */
  async getAdminUsersStats(lang?: string): Promise<AdminUsersStatsResponseDto> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      // Calculate current statistics
      const [
        totalUsers,
        totalRegularUsers,
        totalBusinessUsers,
        totalVerifiedUsers,
        newUsersThisMonth,
        // Previous month statistics
        totalUsersLastMonth,
        totalRegularUsersLastMonth,
        totalBusinessUsersLastMonth,
        totalVerifiedUsersLastMonth,
        newUsersLastMonth,
      ] = await Promise.all([
        // Current totals
        this.prisma.user.count(),
        this.prisma.user.count({
          where: { isFreightForwarder: false },
        }),
        this.prisma.user.count({
          where: { isFreightForwarder: true },
        }),
        this.prisma.user.count({
          where: {
            kycRecords: {
              some: {
                status: KYCStatus.APPROVED,
              },
            },
          },
        }),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: currentMonthStart,
            },
          },
        }),
        // Last month totals (at the end of last month)
        this.prisma.user.count({
          where: {
            createdAt: {
              lte: lastMonthEnd,
            },
          },
        }),
        this.prisma.user.count({
          where: {
            isFreightForwarder: false,
            createdAt: {
              lte: lastMonthEnd,
            },
          },
        }),
        this.prisma.user.count({
          where: {
            isFreightForwarder: true,
            createdAt: {
              lte: lastMonthEnd,
            },
          },
        }),
        this.prisma.user.count({
          where: {
            kycRecords: {
              some: {
                status: KYCStatus.APPROVED,
                verifiedAt: {
                  lte: lastMonthEnd,
                },
              },
            },
          },
        }),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
        }),
      ]);

      // Calculate percentage increases
      const calculatePercentageIncrease = (
        current: number,
        previous: number,
      ): number => {
        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100 * 100) / 100;
      };

      const increasePercentages = {
        totalUsers: Number(
          calculatePercentageIncrease(totalUsers, totalUsersLastMonth),
        ),
        totalRegularUsers: Number(
          calculatePercentageIncrease(
            totalRegularUsers,
            totalRegularUsersLastMonth,
          ),
        ),
        totalBusinessUsers: Number(
          calculatePercentageIncrease(
            totalBusinessUsers,
            totalBusinessUsersLastMonth,
          ),
        ),
        totalVerifiedUsers: Number(
          calculatePercentageIncrease(
            totalVerifiedUsers,
            totalVerifiedUsersLastMonth,
          ),
        ),
        newUsersThisMonth: Number(
          calculatePercentageIncrease(newUsersThisMonth, newUsersLastMonth),
        ),
      };

      const message = await this.i18n.translate(
        'translation.admin.usersStatsSuccess',
        {
          lang,
          defaultValue: 'User statistics retrieved successfully',
        },
      );

      return {
        message,
        stats: {
          totalUsers,
          totalRegularUsers,
          totalBusinessUsers,
          totalVerifiedUsers,
          newUsersThisMonth,
          increasePercentages,
        },
      };
    } catch (error) {
      console.error('Error getting admin user statistics:', error);
      const message = await this.i18n.translate(
        'translation.admin.usersStatsFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve user statistics',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get request statistics for admin dashboard
   */
  async getAdminRequestStats(
    lang?: string,
  ): Promise<AdminRequestStatsResponseDto> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      // Get all requests with cost and currency for price calculation
      const allRequests = await this.prisma.tripRequest.findMany({
        where: {
          cost: {
            not: null,
          },
        },
        select: {
          cost: true,
          currency: true,
        },
      });

      // Calculate average price in EUR
      let totalPriceEUR = 0;
      let requestCountWithPrice = 0;

      for (const request of allRequests) {
        if (request.cost && request.currency) {
          const cost = Number(request.cost);
          const currency = String(request.currency);
          const conversion = this.currencyService.convertCurrency(
            cost,
            currency,
            'EUR',
          );
          totalPriceEUR += conversion.convertedAmount;
          requestCountWithPrice++;
        }
      }

      const averageRequestPriceEUR =
        requestCountWithPrice > 0
          ? Math.round((totalPriceEUR / requestCountWithPrice) * 100) / 100
          : 0;

      // Get total requests and requests by status
      const [
        totalRequests,
        requestsByStatus,
        totalRequestsThisMonth,
        totalRequestsLastMonth,
      ] = await Promise.all([
        this.prisma.tripRequest.count(),
        this.prisma.tripRequest.groupBy({
          by: ['status'],
          _count: {
            id: true,
          },
        }),
        this.prisma.tripRequest.count({
          where: {
            created_at: {
              gte: currentMonthStart,
            },
          },
        }),
        this.prisma.tripRequest.count({
          where: {
            created_at: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
        }),
      ]);

      // Create a map of status counts
      const statusMap = new Map<string, number>();
      requestsByStatus.forEach((item) => {
        statusMap.set(item.status, item._count.id);
      });

      // Calculate percentage increase
      const calculatePercentageIncrease = (
        current: number,
        previous: number,
      ): number => {
        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100 * 100) / 100;
      };

      const percentageIncrease = calculatePercentageIncrease(
        totalRequestsThisMonth,
        totalRequestsLastMonth,
      );

      const message = await this.i18n.translate(
        'translation.admin.requestStatsSuccess',
        {
          lang,
          defaultValue: 'Request statistics retrieved successfully',
        },
      );

      return {
        message,
        stats: {
          totalRequests,
          averageRequestPriceEUR,
          totalRequestsThisMonth,
          totalRequestsLastMonth,
          percentageIncrease,
          requestsByStatus: {
            total_request_pending: statusMap.get(RequestStatus.PENDING) || 0,
            total_request_accepted: statusMap.get(RequestStatus.ACCEPTED) || 0,
            total_request_declined: statusMap.get(RequestStatus.DECLINED) || 0,
            total_request_cancelled:
              statusMap.get(RequestStatus.CANCELLED) || 0,
            total_request_refunded: statusMap.get(RequestStatus.REFUNDED) || 0,
            total_request_expired: statusMap.get(RequestStatus.EXPIRED) || 0,
            total_request_confirmed:
              statusMap.get(RequestStatus.CONFIRMED) || 0,
            total_request_sent: statusMap.get(RequestStatus.SENT) || 0,
            total_request_received: statusMap.get(RequestStatus.RECEIVED) || 0,
            total_request_in_transit:
              statusMap.get(RequestStatus.IN_TRANSIT) || 0,
            total_request_pending_delivery:
              statusMap.get(RequestStatus.PENDING_DELIVERY) || 0,
            total_request_delivered:
              statusMap.get(RequestStatus.DELIVERED) || 0,
            total_request_reviewed: statusMap.get(RequestStatus.REVIEWED) || 0,
          },
        },
      };
    } catch (error) {
      console.error('Error getting admin request statistics:', error);
      const message = await this.i18n.translate(
        'translation.admin.requestStatsFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve request statistics',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get chat statistics for admin
   */
  async getAdminChatsStats(lang?: string): Promise<AdminChatsStatsResponseDto> {
    try {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      // Get statistics in parallel
      const [
        totalChats,
        totalMessages,
        totalMessagesToday,
        totalMessagesThisMonth,
        totalMessagesLastMonth,
        onlineUsers,
        totalFlaggedMessages,
        totalFlaggedChats,
      ] = await Promise.all([
        this.prisma.chat.count(),
        this.prisma.message.count(),
        this.prisma.message.count({
          where: {
            createdAt: {
              gte: todayStart,
            },
          },
        }),
        this.prisma.message.count({
          where: {
            createdAt: {
              gte: currentMonthStart,
            },
          },
        }),
        this.prisma.message.count({
          where: {
            createdAt: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
        }),
        this.redisService.getOnlineUsers(),
        this.prisma.message.count({
          where: {
            is_flagged: true,
          },
        }),
        this.prisma.chat.count({
          where: {
            is_flagged: true,
          },
        }),
      ]);

      // Calculate percentage increase
      const calculatePercentageIncrease = (
        current: number,
        previous: number,
      ): number => {
        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100 * 100) / 100;
      };

      const percentageIncrease = calculatePercentageIncrease(
        totalMessagesThisMonth,
        totalMessagesLastMonth,
      );

      const message = await this.i18n.translate(
        'translation.admin.chatsStatsSuccess',
        {
          lang,
          defaultValue: 'Chat statistics retrieved successfully',
        },
      );

      return {
        message,
        stats: {
          totalChats,
          totalMessages,
          totalMessagesToday,
          totalMessagesThisMonth,
          totalMessagesLastMonth,
          percentageIncrease,
          totalUsersOnline: onlineUsers.length,
          totalFlaggedMessages,
          totalFlaggedChats,
        },
      };
    } catch (error) {
      console.error('Error getting admin chat statistics:', error);
      const message = await this.i18n.translate(
        'translation.admin.chatsStatsFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve chat statistics',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get all requests for admin with filters and pagination
   */
  async getAdminRequests(
    query: AdminGetRequestsQueryDto,
    lang?: string,
  ): Promise<AdminGetRequestsResponseDto> {
    try {
      const {
        page = 1,
        limit = 20,
        requestId,
        departure,
        destination,
        from,
        to,
        status,
      } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {};

      // Request ID filter
      if (requestId) {
        whereClause.id = requestId;
      }

      // Status filter
      if (status) {
        whereClause.status = status;
      }

      // Date range filter
      if (from || to) {
        whereClause.created_at = {};
        if (from) {
          whereClause.created_at.gte = new Date(from);
        }
        if (to) {
          whereClause.created_at.lte = new Date(to);
        }
      }

      // Build trip filters for departure and destination (JSON fields)
      // For departure: match city OR country
      // For destination: match city OR country
      // If both are provided, combine with AND
      const tripWhereClause: any = {};

      if (departure) {
        tripWhereClause.OR = [
          {
            departure: {
              path: ['city'],
              string_contains: departure,
              mode: 'insensitive',
            },
          },
          {
            departure: {
              path: ['country'],
              string_contains: departure,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (destination) {
        const destinationFilters = [
          {
            destination: {
              path: ['city'],
              string_contains: destination,
              mode: 'insensitive',
            },
          },
          {
            destination: {
              path: ['country'],
              string_contains: destination,
              mode: 'insensitive',
            },
          },
        ];

        if (tripWhereClause.OR) {
          // We have both departure and destination - need to combine them properly
          // Create nested structure: (departure match) AND (destination match)
          tripWhereClause.AND = [
            { OR: tripWhereClause.OR },
            { OR: destinationFilters },
          ];
          delete tripWhereClause.OR;
        } else {
          tripWhereClause.OR = destinationFilters;
        }
      }

      // Apply trip filters to whereClause
      if (Object.keys(tripWhereClause).length > 0) {
        whereClause.trip = tripWhereClause;
      }

      // Get requests with pagination
      const [requests, total] = await Promise.all([
        this.prisma.tripRequest.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            trip: {
              select: {
                id: true,
                departure: true,
                destination: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            request_items: {
              select: {
                trip_item_id: true,
                quantity: true,
                special_notes: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
        }),
        this.prisma.tripRequest.count({ where: whereClause }),
      ]);

      // Convert costs to EUR and build response
      const requestDtos = await Promise.all(
        requests.map(async (request) => {
          let costEUR: number | null = null;
          if (request.cost && request.currency) {
            const cost = Number(request.cost);
            const currency = String(request.currency);
            const conversion = this.currencyService.convertCurrency(
              cost,
              currency,
              'EUR',
            );
            costEUR = Math.round(conversion.convertedAmount * 100) / 100;
          }

          return {
            id: request.id,
            sender: {
              id: request.user.id,
              firstName: request.user.firstName,
              lastName: request.user.lastName,
            },
            traveler: {
              id: request.trip.user.id,
              firstName: request.trip.user.firstName,
              lastName: request.trip.user.lastName,
            },
            trip_id: request.trip.id,
            requested_items: request.request_items.map((item) => ({
              trip_item_id: item.trip_item_id,
              quantity: item.quantity,
              special_notes: item.special_notes,
            })),
            trip_departure: request.trip.departure,
            trip_destination: request.trip.destination,
            cost_eur: costEUR,
            status: request.status,
            created_at: request.created_at,
          };
        }),
      );

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.admin.getRequestsSuccess',
        {
          lang,
          defaultValue: 'Requests retrieved successfully',
        },
      );

      return {
        message,
        requests: requestDtos,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting admin requests:', error);
      const message = await this.i18n.translate(
        'translation.admin.getRequestsFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve requests',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get all users for admin with filters and optimized aggregations
   */
  async getAllUsersAdmin(
    query: AdminGetAllUsersQueryDto,
    lang?: string,
  ): Promise<AdminGetAllUsersResponseDto> {
    try {
      const {
        page = 1,
        limit = 20,
        searchKey,
        status = UserStatusFilter.ALL,
      } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {};

      // Search filter
      if (searchKey) {
        const searchPattern = `%${searchKey}%`;
        whereClause.OR = [
          { firstName: { contains: searchKey, mode: 'insensitive' } },
          { lastName: { contains: searchKey, mode: 'insensitive' } },
          { username: { contains: searchKey, mode: 'insensitive' } },
          { email: { contains: searchKey, mode: 'insensitive' } },
          { companyName: { contains: searchKey, mode: 'insensitive' } },
        ];
      }

      // Status filter
      switch (status) {
        case UserStatusFilter.REGULAR:
          whereClause.isFreightForwarder = false;
          break;
        case UserStatusFilter.BUSINESS:
          whereClause.isFreightForwarder = true;
          break;
        case UserStatusFilter.VERIFIED:
          whereClause.kycRecords = {
            some: {
              status: KYCStatus.APPROVED,
            },
          };
          break;
        case UserStatusFilter.UNVERIFIED:
          const unverifiedCondition = {
            OR: [
              { kycRecords: { none: {} } },
              {
                kycRecords: {
                  none: {
                    status: KYCStatus.APPROVED,
                  },
                },
              },
            ],
          };
          if (searchKey && whereClause.OR) {
            // Combine search filter with unverified filter
            whereClause.AND = [{ OR: whereClause.OR }, unverifiedCondition];
            delete whereClause.OR;
          } else {
            Object.assign(whereClause, unverifiedCondition);
          }
          break;
        case UserStatusFilter.SUSPENDED:
          whereClause.is_suspended = true;
          break;
      }

      // Get users with pagination
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where: whereClause,
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            isFreightForwarder: true,
            createdAt: true,
            is_deleted: true,
            kycRecords: {
              select: {
                id: true,
                status: true,
                provider: true,
                rejectionReason: true,
                createdAt: true,
                updatedAt: true,
                verifiedAt: true,
              },
              take: 1,
              orderBy: {
                updatedAt: 'desc',
              },
            },
            trips: {
              select: {
                id: true,
                status: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where: whereClause }),
      ]);

      // Get user IDs for batch aggregation queries
      const userIds = users.map((u) => u.id);

      // Batch queries for aggregations
      const [requestCounts, tripCounts, revenueSums, ratings, ongoingTrips] =
        await Promise.all([
          // Total requests per user
          this.prisma.tripRequest.groupBy({
            by: ['user_id'],
            where: {
              user_id: { in: userIds },
            },
            _count: {
              id: true,
            },
          }),

          // Total trips per user
          this.prisma.trip.groupBy({
            by: ['user_id'],
            where: {
              user_id: { in: userIds },
            },
            _count: {
              id: true,
            },
          }),

          // Revenue: get costs and currencies from requests on trips created by user
          // We'll convert to EUR after fetching
          userIds.length > 0
            ? this.prisma.tripRequest.findMany({
                where: {
                  trip: {
                    user_id: { in: userIds },
                  },
                  status: {
                    in: [
                      RequestStatus.CONFIRMED,
                      RequestStatus.SENT,
                      RequestStatus.RECEIVED,
                      RequestStatus.PENDING_DELIVERY,
                      RequestStatus.IN_TRANSIT,
                      RequestStatus.DELIVERED,
                      RequestStatus.REVIEWED,
                    ],
                  },
                  cost: {
                    not: null,
                  },
                },
                select: {
                  cost: true,
                  currency: true,
                  trip: {
                    select: {
                      user_id: true,
                    },
                  },
                },
              })
            : [],

          // Average ratings per user
          this.prisma.rating.groupBy({
            by: ['receiver_id'],
            where: {
              receiver_id: { in: userIds },
            },
            _avg: {
              rating: true,
            },
          }),

          // Users with ongoing trips
          this.prisma.trip.findMany({
            where: {
              user_id: { in: userIds },
              status: {
                in: [
                  TripStatus.SCHEDULED,
                  TripStatus.INPROGRESS,
                  TripStatus.RESCHEDULED,
                ],
              },
            },
            select: {
              user_id: true,
            },
            distinct: ['user_id'],
          }),
        ]);

      // Create maps for quick lookup
      const requestCountMap = new Map<string, number>(
        requestCounts.map((r) => [r.user_id, r._count.id] as [string, number]),
      );
      const tripCountMap = new Map<string, number>(
        tripCounts.map((t) => [t.user_id, t._count.id] as [string, number]),
      );
      // Calculate revenue in EUR by converting each request cost
      const revenueMap = new Map<string, number>();
      if (Array.isArray(revenueSums)) {
        revenueSums.forEach((request) => {
          const userId = request.trip.user_id;
          const cost = request.cost ? Number(request.cost) : 0;
          // Currency enum value (XAF, USD, EUR, CAD) or null
          const currency = request.currency ? String(request.currency) : 'EUR'; // Default to EUR if no currency

          if (cost > 0) {
            // Convert to EUR
            const conversion = this.currencyService.convertCurrency(
              cost,
              currency,
              'EUR',
            );
            const revenueInEUR = conversion.convertedAmount;

            // Add to user's total revenue
            const currentRevenue = revenueMap.get(userId) || 0;
            revenueMap.set(userId, currentRevenue + revenueInEUR);
          }
        });
      }
      const ratingMap = new Map<string, number>(
        ratings.map(
          (r) =>
            [
              r.receiver_id,
              r._avg.rating ? Math.round(r._avg.rating * 100) / 100 : 0,
            ] as [string, number],
        ),
      );
      const ongoingTripUserIds = new Set<string>(
        ongoingTrips.map((t) => t.user_id),
      );

      // Build response
      const userDtos = users.map((user) => {
        const kycStatus =
          user.kycRecords && user.kycRecords.length > 0
            ? user.kycRecords[0].status
            : null;

        // Determine user status
        let userStatus: 'active' | 'unverified' | 'travelling';
        if (ongoingTripUserIds.has(user.id)) {
          userStatus = 'travelling';
        } else if (kycStatus === KYCStatus.APPROVED) {
          userStatus = 'active';
        } else {
          userStatus = 'unverified';
        }

        const revenue = revenueMap.get(user.id) ?? 0;
        // Round to 2 decimal places for EUR
        const revenueInEUR = Math.round(revenue * 100) / 100;

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isFreightForwarder: user.isFreightForwarder,
          createdAt: user.createdAt,
          total_request: requestCountMap.get(user.id) ?? 0,
          total_trips: tripCountMap.get(user.id) ?? 0,
          total_revenue: revenueInEUR,
          rating: ratingMap.get(user.id) ?? 0,
          status: userStatus,
          is_deleted: user.is_deleted,
          kyc:
            user.kycRecords && user.kycRecords.length > 0
              ? user.kycRecords[0]
              : null,
        };
      });

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.admin.getAllUsersSuccess',
        {
          lang,
          defaultValue: 'Users retrieved successfully',
        },
      );

      return {
        message,
        users: userDtos,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting all users for admin:', error);
      const message = await this.i18n.translate(
        'translation.admin.getAllUsersFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve users',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get detailed user information for admin
   */
  async getAdminUserDetails(
    userId: string,
    lang?: string,
  ): Promise<AdminUserDetailsResponseDto> {
    try {
      // Get user with all details
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: userSelect,
      });

      if (!user) {
        const message = await this.i18n.translate('translation.user.notFound', {
          lang,
          defaultValue: 'User not found',
        });
        throw new NotFoundException(message);
      }

      // Calculate statistics in parallel
      const [
        ratings,
        tripsCount,
        totalRequestsSent,
        totalRequestsCompleted,
        totalRequestsReviewed,
      ] = await Promise.all([
        // Get all ratings received by this user
        this.prisma.rating.findMany({
          where: { receiver_id: userId },
          select: { rating: true },
        }),
        // Count trips created by this user
        this.prisma.trip.count({
          where: { user_id: userId },
        }),
        // Count all requests sent by this user
        this.prisma.tripRequest.count({
          where: { user_id: userId },
        }),
        // Count completed requests (DELIVERED, REVIEWED)
        this.prisma.tripRequest.count({
          where: {
            user_id: userId,
            status: {
              in: [RequestStatus.DELIVERED, RequestStatus.REVIEWED],
            },
          },
        }),
        // Count reviewed requests (REVIEWED)
        this.prisma.tripRequest.count({
          where: {
            user_id: userId,
            status: RequestStatus.REVIEWED,
          },
        }),
      ]);

      // Calculate average rating
      const totalRatings = ratings.length;
      const averageRating =
        totalRatings > 0
          ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
          : 0;

      const message = await this.i18n.translate(
        'translation.admin.getUserDetailsSuccess',
        {
          lang,
          defaultValue: 'User details retrieved successfully',
        },
      );

      return {
        message,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          address: user.address,
          city: user.city,
          state: user.state,
          zip: user.zip,
          picture: user.picture,
          name: user.name,
          isFreightForwarder: user.isFreightForwarder,
          companyName: user.companyName,
          companyAddress: user.companyAddress,
          businessType: user.businessType,
          currency: user.currency,
          lang: user.lang,
          date_of_birth: user.date_of_birth,
          role: user.role,
          is_suspended: user.is_suspended || false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          services: (user.services || []).map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description || undefined,
          })),
          cities: (user.cities || []).map((c) => ({
            id: c.id,
            name: c.name,
            address: c.address,
            contactName: c.contactName,
            contactPhone: c.contactPhone,
          })),
          kycRecords: (user.kycRecords || []).map((k) => ({
            id: k.id,
            status: k.status,
            provider: k.provider,
            rejectionReason: k.rejectionReason || undefined,
            createdAt: k.createdAt,
            updatedAt: k.updatedAt,
          })),
          averageRating: Math.round(averageRating * 100) / 100,
          totalRatings,
          totalTrips: tripsCount,
          totalRequestsSent,
          totalRequestsCompleted,
          totalRequestsReviewed,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error getting admin user details:', error);
      const message = await this.i18n.translate(
        'translation.admin.getUserDetailsFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve user details',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get user wallet information with ungrouped transactions for admin
   */
  async getAdminUserWallet(
    userId: string,
    paginationDto: PaginationQueryDto,
    lang?: string,
  ): Promise<AdminUserWalletResponseDto> {
    try {
      const page = paginationDto.page || 1;
      const limit = paginationDto.limit || 20;
      const skip = (page - 1) * limit;

      // Fetch wallet and transaction data in parallel
      const [
        wallet,
        totalCount,
        earningsAggregation,
        withdrawnAggregation,
        transactions,
      ] = await Promise.all([
        this.walletService.getWallet(userId),
        // Get total count of transactions
        this.prisma.transaction.count({
          where: { userId },
        }),
        // Calculate total earnings (CREDIT transactions)
        this.prisma.transaction.aggregate({
          where: {
            userId,
            type: 'CREDIT',
          },
          _sum: {
            amount_paid: true,
          },
        }),
        // Calculate total withdrawn (WITHDRAW transactions)
        this.prisma.transaction.aggregate({
          where: {
            userId,
            source: 'WITHDRAW',
          },
          _sum: {
            amount_paid: true,
          },
        }),
        // Get paginated transactions with related data
        this.prisma.transaction.findMany({
          where: { userId },
          include: {
            trip: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    picture: true,
                  },
                },
              },
            },
            request: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    picture: true,
                  },
                },
                request_items: {
                  select: {
                    quantity: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      // Map transactions to detailed DTOs (not grouped)
      const detailedTransactions: DetailedTransactionDto[] = transactions.map(
        (t) => {
          const dto: DetailedTransactionDto = {
            id: t.id,
            type: t.type,
            source: t.source,
            status: t.status,
            amountRequested: Number(t.amount_requested),
            feeApplied: Number(t.fee_applied),
            amountPaid: Number(t.amount_paid),
            currency: t.currency,
            provider: t.provider,
            createdAt: t.createdAt,
            processedAt: t.processedAt || undefined,
          };

          // Add trip information if available
          if (t.trip) {
            dto.tripDeparture = t.trip.departure;
            dto.tripDestination = t.trip.destination;
            dto.tripStatus = t.trip.status;
            dto.tripCreator = {
              id: t.trip.user.id,
              name: t.trip.user.name,
              picture: t.trip.user.picture || undefined,
            };
          }

          // Add request user information if available
          if (t.request) {
            dto.requestUser = {
              id: t.request.user.id,
              name: t.request.user.name,
              picture: t.request.user.picture || undefined,
            };

            // Calculate total booked kg from request items
            if (t.request.request_items && t.request.request_items.length > 0) {
              dto.bookedKg = t.request.request_items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              );
            }
          }

          return dto;
        },
      );

      const totalEarnings = Number(earningsAggregation._sum.amount_paid || 0);
      const totalWithdrawn = Number(withdrawnAggregation._sum.amount_paid || 0);
      const totalPages = Math.ceil(totalCount / limit);

      const message = await this.i18n.translate(
        'translation.admin.getUserWalletSuccess',
        {
          lang,
          defaultValue: 'User wallet information retrieved successfully',
        },
      );

      const transactionsResponse: AdminUserWalletTransactionsResponseDto = {
        transactions: detailedTransactions,
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        totalEarnings,
        totalWithdrawn,
      };

      return {
        message,
        wallet,
        transactions: transactionsResponse,
      };
    } catch (error) {
      console.error('Error getting admin user wallet:', error);
      const message = await this.i18n.translate(
        'translation.admin.getUserWalletFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve user wallet information',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get trip statistics for admin dashboard
   */
  async getAdminTripsStats(lang?: string): Promise<AdminTripsStatsResponseDto> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      // Calculate date range for next 7 days
      const next7DaysStart = new Date(now);
      next7DaysStart.setHours(0, 0, 0, 0);
      const next7DaysEnd = new Date(now);
      next7DaysEnd.setDate(next7DaysEnd.getDate() + 7);
      next7DaysEnd.setHours(23, 59, 59, 999);

      // Get statistics in parallel
      const [
        totalTrips,
        totalTripsThisMonth,
        totalTripsLastMonth,
        totalTripsInProgress,
        totalTripsDepartingNext7Days,
        totalTripsCompleted,
        totalRequests,
      ] = await Promise.all([
        this.prisma.trip.count({
          where: {
            is_deleted: false, // Exclude deleted trips
            user: {
              is_deleted: false,
            },
          },
        }),
        this.prisma.trip.count({
          where: {
            createdAt: {
              gte: currentMonthStart,
            },
            is_deleted: false, // Exclude deleted trips
            user: {
              is_deleted: false,
            },
          },
        }),
        this.prisma.trip.count({
          where: {
            createdAt: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
            is_deleted: false, // Exclude deleted trips
            user: {
              is_deleted: false,
            },
          },
        }),
        this.prisma.trip.count({
          where: {
            status: TripStatus.INPROGRESS,
            is_deleted: false, // Exclude deleted trips
            user: {
              is_deleted: false,
            },
          },
        }),
        this.prisma.trip.count({
          where: {
            departure_date: {
              gte: next7DaysStart,
              lte: next7DaysEnd,
            },
            is_deleted: false, // Exclude deleted trips
            user: {
              is_deleted: false,
            },
          },
        }),
        this.prisma.trip.count({
          where: {
            status: TripStatus.COMPLETED,
            is_deleted: false, // Exclude deleted trips
            user: {
              is_deleted: false,
            },
          },
        }),
        this.prisma.tripRequest.count(),
      ]);

      // Calculate percentage increase
      const calculatePercentageIncrease = (
        current: number,
        previous: number,
      ): number => {
        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100 * 100) / 100;
      };

      const percentageIncrease = calculatePercentageIncrease(
        totalTripsThisMonth,
        totalTripsLastMonth,
      );

      // Calculate average requests per trip
      const averageRequestsPerTrip =
        totalTrips > 0
          ? Math.round((totalRequests / totalTrips) * 100) / 100
          : 0;

      const message = await this.i18n.translate(
        'translation.admin.tripsStatsSuccess',
        {
          lang,
          defaultValue: 'Trip statistics retrieved successfully',
        },
      );

      return {
        message,
        stats: {
          totalTrips,
          totalTripsThisMonth,
          totalTripsLastMonth,
          percentageIncrease,
          totalTripsInProgress,
          totalTripsDepartingNext7Days,
          totalTripsCompleted,
          averageRequestsPerTrip,
        },
      };
    } catch (error) {
      console.error('Error getting admin trip statistics:', error);
      const message = await this.i18n.translate(
        'translation.admin.tripsStatsFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve trip statistics',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get trips for admin with filters, request counts and revenue in EUR
   */
  async getAdminTrips(
    query: AdminGetTripsQueryDto,
    lang?: string,
  ): Promise<AdminGetTripsResponseDto> {
    try {
      const {
        page = 1,
        limit = 20,
        userId,
        status,
        searchKey,
        tripId,
        departure,
        destination,
        from,
        to,
      } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {
        // Exclude trips from deleted users and deleted trips
        user: {
          is_deleted: false,
        },
        is_deleted: false, // Exclude deleted trips
      };

      // Filter by userId if provided
      if (userId) {
        whereClause.user_id = userId;
      }

      // Filter by status if provided
      if (status) {
        whereClause.status = status;
      }

      // Filter by tripId if provided
      if (tripId) {
        whereClause.id = tripId;
      }

      // Filter by departure (city or country) if provided
      if (departure) {
        whereClause.OR = [
          {
            departure: {
              path: ['city'],
              string_contains: departure,
              mode: 'insensitive',
            },
          },
          {
            departure: {
              path: ['country'],
              string_contains: departure,
              mode: 'insensitive',
            },
          },
        ];
      }

      // Filter by destination (city or country) if provided
      if (destination) {
        const destinationFilter = [
          {
            destination: {
              path: ['city'],
              string_contains: destination,
              mode: 'insensitive',
            },
          },
          {
            destination: {
              path: ['country'],
              string_contains: destination,
              mode: 'insensitive',
            },
          },
        ];

        // If departure filter already exists, combine with AND
        if (whereClause.OR) {
          whereClause.AND = [{ OR: whereClause.OR }, { OR: destinationFilter }];
          delete whereClause.OR;
        } else {
          whereClause.OR = destinationFilter;
        }
      }

      // Filter by createdAt date range
      if (from || to) {
        whereClause.createdAt = {};
        if (from) {
          whereClause.createdAt.gte = new Date(from);
        }
        if (to) {
          whereClause.createdAt.lte = new Date(to);
        }
      }

      // Get trips with pagination
      let trips: any[];
      let total: number;

      if (searchKey) {
        // For searchKey, we need to get all trips matching other filters first,
        // then filter by searchKey in memory (for JSON fields) or by ID in DB
        // Get trips matching all other filters (userId, status, date range)
        // We'll search by ID in DB and JSON fields in memory
        // Get trips matching all other filters (userId, status, date range)
        // We'll filter by searchKey in memory for JSON fields
        const allTrips = await this.prisma.trip.findMany({
          where: whereClause, // Apply all filters (userId, status, date range)
          select: {
            id: true,
            departure: true,
            destination: true,
            status: true,
            departure_date: true,
            departure_time: true,
            arrival_date: true,
            arrival_time: true,
            createdAt: true,
            trip_items: {
              select: {
                avalailble_kg: true,
              },
            },
            airline: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            mode_of_transport: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                kycRecords: {
                  select: {
                    id: true,
                    status: true,
                    provider: true,
                    rejectionReason: true,
                    createdAt: true,
                    updatedAt: true,
                    verifiedAt: true,
                    expiresAt: true,
                  },
                  orderBy: {
                    createdAt: 'desc',
                  },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Filter by searchKey in memory (covers trip ID, departure JSON, destination JSON)
        const searchLower = searchKey.toLowerCase();
        const filteredTrips = allTrips.filter((trip) => {
          // Check trip ID
          const matchesId = trip.id.toLowerCase().includes(searchLower);

          // Check departure JSON (city and country)
          let matchesDeparture = false;
          if (trip.departure) {
            const departure = trip.departure as any;
            const departureStr = JSON.stringify(departure).toLowerCase();
            matchesDeparture = departureStr.includes(searchLower);
          }

          // Check destination JSON (city and country)
          let matchesDestination = false;
          if (trip.destination) {
            const destination = trip.destination as any;
            const destinationStr = JSON.stringify(destination).toLowerCase();
            matchesDestination = destinationStr.includes(searchLower);
          }

          return matchesId || matchesDeparture || matchesDestination;
        });

        // Apply pagination after filtering
        total = filteredTrips.length;
        trips = filteredTrips.slice(skip, skip + limit);
      } else {
        // No search key, use standard query
        [trips, total] = await Promise.all([
          this.prisma.trip.findMany({
            where: whereClause,
            select: {
              id: true,
              departure: true,
              destination: true,
              status: true,
              departure_date: true,
              departure_time: true,
              arrival_date: true,
              arrival_time: true,
              createdAt: true,
              trip_items: {
                select: {
                  avalailble_kg: true,
                },
              },
              airline: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
              mode_of_transport: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  kycRecords: {
                    select: {
                      id: true,
                      status: true,
                      provider: true,
                      rejectionReason: true,
                      createdAt: true,
                      updatedAt: true,
                      verifiedAt: true,
                      expiresAt: true,
                    },
                    orderBy: {
                      createdAt: 'desc',
                    },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          this.prisma.trip.count({
            where: whereClause,
          }),
        ]);
      }

      // Get trip IDs for batch queries
      const tripIds = trips.map((t) => t.id);

      // Batch queries for request counts, revenue, and booked kg
      const [requestCounts, revenueRequests, bookedKgData] = await Promise.all([
        // Count requests per trip
        this.prisma.tripRequest.groupBy({
          by: ['trip_id'],
          where: {
            trip_id: { in: tripIds },
          },
          _count: {
            id: true,
          },
        }),
        // Get requests with costs for revenue calculation
        tripIds.length > 0
          ? this.prisma.tripRequest.findMany({
              where: {
                trip_id: { in: tripIds },
                status: {
                  in: [
                    RequestStatus.CONFIRMED,
                    RequestStatus.SENT,
                    RequestStatus.RECEIVED,
                    RequestStatus.PENDING_DELIVERY,
                    RequestStatus.IN_TRANSIT,
                    RequestStatus.DELIVERED,
                    RequestStatus.REVIEWED,
                  ],
                },
                cost: {
                  not: null,
                },
              },
              select: {
                trip_id: true,
                cost: true,
                currency: true,
              },
            })
          : [],
        // Get request items to calculate booked kg
        tripIds.length > 0
          ? this.prisma.tripRequest.findMany({
              where: {
                trip_id: { in: tripIds },
                status: {
                  notIn: [
                    RequestStatus.CANCELLED,
                    RequestStatus.DECLINED,
                    RequestStatus.REFUNDED,
                  ],
                },
              },
              select: {
                trip_id: true,
                request_items: {
                  select: {
                    quantity: true,
                  },
                },
              },
            })
          : [],
      ]);

      // Create maps for quick lookup
      const requestCountMap = new Map<string, number>();
      requestCounts.forEach((r) => {
        requestCountMap.set(r.trip_id, r._count.id);
      });

      // Calculate revenue per trip in EUR
      const revenueMap = new Map<string, number>();
      if (Array.isArray(revenueRequests)) {
        revenueRequests.forEach((request) => {
          const tripId = request.trip_id;
          const cost = request.cost ? Number(request.cost) : 0;
          const currency = request.currency ? String(request.currency) : 'EUR';

          if (cost > 0) {
            // Convert to EUR
            const conversion = this.currencyService.convertCurrency(
              cost,
              currency,
              'EUR',
            );
            const revenueInEUR = conversion.convertedAmount;

            // Add to trip's total revenue
            const currentRevenue = revenueMap.get(tripId) || 0;
            revenueMap.set(tripId, currentRevenue + revenueInEUR);
          }
        });
      }

      // Calculate booked kg per trip
      const bookedKgMap = new Map<string, number>();
      if (Array.isArray(bookedKgData)) {
        bookedKgData.forEach((request) => {
          const tripId = request.trip_id;
          const requestKg = request.request_items.reduce((sum, item) => {
            return sum + item.quantity;
          }, 0);

          // Add to trip's total booked kg
          const currentBookedKg = bookedKgMap.get(tripId) || 0;
          bookedKgMap.set(tripId, currentBookedKg + requestKg);
        });
      }

      // Build response
      const tripDtos = trips.map((trip) => {
        const revenue = revenueMap.get(trip.id) ?? 0;
        const revenueInEUR = Math.round(revenue * 100) / 100;
        const bookedKg = bookedKgMap.get(trip.id) ?? 0;

        // Calculate available_kg as sum of avalailble_kg from trip_items
        const availableKg = trip.trip_items
          ? trip.trip_items.reduce((sum, item) => {
              return (
                sum + (item.avalailble_kg ? Number(item.avalailble_kg) : 0)
              );
            }, 0)
          : 0;

        // Get KYC data (most recent record)
        const kycData =
          trip.user?.kycRecords && trip.user.kycRecords.length > 0
            ? {
                id: trip.user.kycRecords[0].id,
                status: trip.user.kycRecords[0].status,
                provider: trip.user.kycRecords[0].provider,
                rejectionReason: trip.user.kycRecords[0].rejectionReason,
                createdAt: trip.user.kycRecords[0].createdAt,
                updatedAt: trip.user.kycRecords[0].updatedAt,
                verifiedAt: trip.user.kycRecords[0].verifiedAt,
                expiresAt: trip.user.kycRecords[0].expiresAt,
              }
            : null;

        return {
          id: trip.id,
          departure: trip.departure,
          destination: trip.destination,
          status: trip.status,
          departure_date: trip.departure_date,
          departure_time: trip.departure_time,
          arrival_date: trip.arrival_date,
          arrival_time: trip.arrival_time,
          airline: trip.airline,
          mode_of_transport: trip.mode_of_transport,
          createdAt: trip.createdAt,
          totalRequests: requestCountMap.get(trip.id) ?? 0,
          revenue: revenueInEUR,
          available_kg: availableKg > 0 ? availableKg : null,
          booked_kg: bookedKg,
          user: trip.user
            ? {
                id: trip.user.id,
                firstName: trip.user.firstName,
                lastName: trip.user.lastName,
                kyc: kycData,
              }
            : null,
        };
      });

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.admin.getTripsSuccess',
        {
          lang,
          defaultValue: 'Trips retrieved successfully',
        },
      );

      return {
        message,
        trips: tripDtos,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting admin trips:', error);
      const message = await this.i18n.translate(
        'translation.admin.getTripsFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve trips',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Suspend or unsuspend a user (Admin only)
   */
  async suspendUser(
    userId: string,
    dto: AdminSuspendUserDto,
    lang?: string,
  ): Promise<AdminSuspendUserResponseDto> {
    try {
      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!existingUser) {
        const message = await this.i18n.translate(
          'translation.admin.userNotFound',
          {
            lang,
            defaultValue: 'User not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Update user suspension status
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          is_suspended: dto.suspended,
          status_message_en: dto.status_message_en ?? null,
          status_message_fr: dto.status_message_fr ?? null,
        },
        select: {
          id: true,
          is_suspended: true,
          status_message_en: true,
          status_message_fr: true,
        },
      });

      const message = await this.i18n.translate(
        dto.suspended
          ? 'translation.admin.userSuspended'
          : 'translation.admin.userUnsuspended',
        {
          lang,
          defaultValue: dto.suspended
            ? 'User suspended successfully'
            : 'User unsuspended successfully',
        },
      );

      return {
        message,
        user: updatedUser,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error suspending user:', error);
      const message = await this.i18n.translate(
        'translation.admin.suspendUserFailed',
        {
          lang,
          defaultValue: 'Failed to suspend/unsuspend user',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Flag a message or chat (Admin only)
   * - For messages: sets is_flagged = true on the message and increments flag_count on the sender by 1
   * - For chats: sets is_flagged = true on the chat and increments flag_count on both chat members by 1
   */
  async flagContent(
    dto: AdminFlagContentDto,
    lang?: string,
  ): Promise<AdminFlagContentResponseDto> {
    try {
      if (!dto.messageId && !dto.chatId) {
        throw new BadRequestException(
          'Either messageId or chatId must be provided',
        );
      }

      if (dto.messageId && dto.chatId) {
        throw new BadRequestException(
          'Only one of messageId or chatId should be provided',
        );
      }

      if (dto.messageId) {
        // Flag a message
        const message = await this.prisma.message.findUnique({
          where: { id: dto.messageId },
          select: {
            id: true,
            sender_id: true,
            is_flagged: true,
          },
        });

        if (!message) {
          throw new NotFoundException('Message not found');
        }

        if (message.is_flagged) {
          throw new BadRequestException('Message is already flagged');
        }

        // Update message and increment sender's flag_count in a transaction
        await this.prisma.$transaction([
          this.prisma.message.update({
            where: { id: dto.messageId },
            data: { is_flagged: true },
          }),
          this.prisma.user.update({
            where: { id: message.sender_id },
            data: {
              flag_count: {
                increment: 1,
              },
            },
          }),
        ]);

        const message_text = await this.i18n.translate(
          'translation.admin.flagMessageSuccess',
          {
            lang,
            defaultValue: 'Message flagged successfully',
          },
        );

        return {
          message: message_text,
          type: 'message',
        };
      } else if (dto.chatId) {
        // Flag a chat
        const chat = await this.prisma.chat.findUnique({
          where: { id: dto.chatId },
          select: {
            id: true,
            is_flagged: true,
            members: {
              select: {
                user_id: true,
              },
            },
          },
        });

        if (!chat) {
          throw new NotFoundException('Chat not found');
        }

        if (chat.is_flagged) {
          throw new BadRequestException('Chat is already flagged');
        }

        if (chat.members.length < 2) {
          throw new BadRequestException('Chat must have at least 2 members');
        }

        const userIds = chat.members.map((member) => member.user_id);

        // Update chat and increment flag_count for both members in a transaction
        await this.prisma.$transaction([
          this.prisma.chat.update({
            where: { id: dto.chatId },
            data: { is_flagged: true },
          }),
          // Increment flag_count for all chat members
          ...userIds.map((userId) =>
            this.prisma.user.update({
              where: { id: userId },
              data: {
                flag_count: {
                  increment: 1,
                },
              },
            }),
          ),
        ]);

        const message_text = await this.i18n.translate(
          'translation.admin.flagChatSuccess',
          {
            lang,
            defaultValue: 'Chat flagged successfully',
          },
        );

        return {
          message: message_text,
          type: 'chat',
        };
      }

      // This should never be reached due to validation above
      throw new BadRequestException('Invalid request');
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Error flagging content:', error);
      const message = await this.i18n.translate(
        'translation.admin.flagContentFailed',
        {
          lang,
          defaultValue: 'Failed to flag content',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Move money from user's wallet hold balance to available balance (Admin only)
   */
  async moveHoldBalanceToAvailable(
    dto: AdminMoveHoldBalanceDto,
    lang?: string,
  ): Promise<AdminMoveHoldBalanceResponseDto> {
    try {
      const { userId, amount, currency } = dto;

      // Get user's wallet
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        const message = await this.i18n.translate(
          'translation.wallet.notFound',
          {
            lang,
            defaultValue: 'Wallet not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Determine currency to use
      const targetCurrency = (currency || wallet.currency).toUpperCase();

      // Get currency columns
      const getCurrencyColumns = (
        curr: string,
      ): {
        available: string;
        hold: string;
      } => {
        switch (curr) {
          case 'EUR':
            return {
              available: 'available_balance_eur',
              hold: 'hold_balance_eur',
            };
          case 'USD':
            return {
              available: 'available_balance_usd',
              hold: 'hold_balance_usd',
            };
          case 'CAD':
            return {
              available: 'available_balance_cad',
              hold: 'hold_balance_cad',
            };
          case 'XAF':
            // XAF is display only, convert to EUR for processing
            return {
              available: 'available_balance_eur',
              hold: 'hold_balance_eur',
            };
          default:
            // Default to EUR for unknown currencies
            return {
              available: 'available_balance_eur',
              hold: 'hold_balance_eur',
            };
        }
      };

      const currencyColumns = getCurrencyColumns(targetCurrency);

      // Check if hold balance has sufficient funds
      const holdBalance = Number(wallet[currencyColumns.hold] || 0);

      if (holdBalance < amount) {
        const message = await this.i18n.translate(
          'translation.wallet.insufficientHoldBalance',
          {
            lang,
            defaultValue: `Insufficient hold balance. Available: ${holdBalance} ${targetCurrency}`,
            args: {
              available: holdBalance,
              currency: targetCurrency,
            },
          },
        );
        throw new BadRequestException(message);
      }

      // Get current available balance for balance_after calculation
      const currentAvailableBalance = Number(
        wallet[currencyColumns.available] || 0,
      );

      // Move from hold to available using transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Update wallet balances
        const updatedWallet = await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            [currencyColumns.hold]: {
              decrement: amount,
            },
            [currencyColumns.available]: {
              increment: amount,
            },
          },
        });

        // Create CREDIT transaction with source ADJUSTMENT
        const transaction = await prisma.transaction.create({
          data: {
            userId,
            wallet_id: wallet.id,
            type: 'CREDIT',
            source: 'ADJUSTMENT',
            amount_requested: amount,
            fee_applied: 0,
            amount_paid: amount,
            currency: targetCurrency,
            status: 'COMPLETED',
            provider: 'STRIPE',
            description: `Admin adjustment: Moved ${amount} ${targetCurrency} from hold to available balance`,
            balance_after: currentAvailableBalance + amount,
            metadata: {
              adminAdjustment: true,
              movedFromHold: true,
              originalCurrency: wallet.currency,
            },
          },
        });

        return { updatedWallet, transaction };
      });

      const message = await this.i18n.translate(
        'translation.admin.moveHoldBalanceSuccess',
        {
          lang,
          defaultValue: 'Balance moved successfully',
        },
      );

      return {
        message,
        transaction: {
          id: result.transaction.id,
          type: result.transaction.type,
          source: result.transaction.source,
          amountRequested: Number(result.transaction.amount_requested),
          amountPaid: Number(result.transaction.amount_paid),
          currency: result.transaction.currency,
          status: result.transaction.status,
          balanceAfter: Number(result.transaction.balance_after),
          createdAt: result.transaction.createdAt,
        },
        wallet: {
          availableBalance: Number(
            result.updatedWallet[currencyColumns.available],
          ),
          holdBalance: Number(result.updatedWallet[currencyColumns.hold]),
          currency: targetCurrency,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Error moving hold balance to available:', error);
      const message = await this.i18n.translate(
        'translation.admin.moveHoldBalanceFailed',
        {
          lang,
          defaultValue: 'Failed to move balance',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get analytics statistics for admin dashboard
   */
  async getAdminAnalyticsStats(
    lang?: string,
  ): Promise<AdminAnalyticsStatsResponseDto> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      // Calculate percentage increase helper
      const calculatePercentageIncrease = (
        current: number,
        previous: number,
      ): number => {
        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 100 * 100) / 100;
      };

      // Get total revenue (sum of request costs, excluding certain statuses)
      const revenueRequests = await this.prisma.tripRequest.findMany({
        where: {
          status: {
            notIn: [
              RequestStatus.PENDING,
              RequestStatus.ACCEPTED,
              RequestStatus.DECLINED,
              RequestStatus.CANCELLED,
              RequestStatus.EXPIRED,
            ],
          },
          cost: {
            not: null,
          },
        },
        select: {
          cost: true,
          currency: true,
        },
      });

      let totalRevenueEUR = 0;
      for (const request of revenueRequests) {
        if (request.cost && request.currency) {
          const cost = Number(request.cost);
          const currency = String(request.currency);
          const conversion = this.currencyService.convertCurrency(
            cost,
            currency,
            'EUR',
          );
          totalRevenueEUR += conversion.convertedAmount;
        }
      }
      totalRevenueEUR = Math.round(totalRevenueEUR * 100) / 100;

      // Get total revenue this month
      const revenueRequestsThisMonth = await this.prisma.tripRequest.findMany({
        where: {
          status: {
            notIn: [
              RequestStatus.PENDING,
              RequestStatus.ACCEPTED,
              RequestStatus.DECLINED,
              RequestStatus.CANCELLED,
              RequestStatus.EXPIRED,
            ],
          },
          cost: {
            not: null,
          },
          created_at: {
            gte: currentMonthStart,
          },
        },
        select: {
          cost: true,
          currency: true,
        },
      });

      let totalRevenueThisMonthEUR = 0;
      for (const request of revenueRequestsThisMonth) {
        if (request.cost && request.currency) {
          const cost = Number(request.cost);
          const currency = String(request.currency);
          const conversion = this.currencyService.convertCurrency(
            cost,
            currency,
            'EUR',
          );
          totalRevenueThisMonthEUR += conversion.convertedAmount;
        }
      }
      totalRevenueThisMonthEUR =
        Math.round(totalRevenueThisMonthEUR * 100) / 100;

      // Get total revenue last month
      const revenueRequestsLastMonth = await this.prisma.tripRequest.findMany({
        where: {
          status: {
            notIn: [
              RequestStatus.PENDING,
              RequestStatus.ACCEPTED,
              RequestStatus.DECLINED,
              RequestStatus.CANCELLED,
              RequestStatus.EXPIRED,
            ],
          },
          cost: {
            not: null,
          },
          created_at: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
        select: {
          cost: true,
          currency: true,
        },
      });

      let totalRevenueLastMonthEUR = 0;
      for (const request of revenueRequestsLastMonth) {
        if (request.cost && request.currency) {
          const cost = Number(request.cost);
          const currency = String(request.currency);
          const conversion = this.currencyService.convertCurrency(
            cost,
            currency,
            'EUR',
          );
          totalRevenueLastMonthEUR += conversion.convertedAmount;
        }
      }
      totalRevenueLastMonthEUR =
        Math.round(totalRevenueLastMonthEUR * 100) / 100;

      // Get all wallets and sum balances
      const allWallets = await this.prisma.wallet.findMany({
        select: {
          available_balance_xaf: true,
          available_balance_usd: true,
          available_balance_eur: true,
          available_balance_cad: true,
          hold_balance_xaf: true,
          hold_balance_usd: true,
          hold_balance_eur: true,
          hold_balance_cad: true,
        },
      });

      let totalAvailableEUR = 0;
      let totalHoldEUR = 0;

      for (const wallet of allWallets) {
        // Convert available balances to EUR
        const xafAvail = Number(wallet.available_balance_xaf) || 0;
        const usdAvail = Number(wallet.available_balance_usd) || 0;
        const eurAvail = Number(wallet.available_balance_eur) || 0;
        const cadAvail = Number(wallet.available_balance_cad) || 0;

        if (xafAvail > 0) {
          const conv = this.currencyService.convertCurrency(
            xafAvail,
            'XAF',
            'EUR',
          );
          totalAvailableEUR += conv.convertedAmount;
        }
        if (usdAvail > 0) {
          const conv = this.currencyService.convertCurrency(
            usdAvail,
            'USD',
            'EUR',
          );
          totalAvailableEUR += conv.convertedAmount;
        }
        totalAvailableEUR += eurAvail;
        if (cadAvail > 0) {
          const conv = this.currencyService.convertCurrency(
            cadAvail,
            'CAD',
            'EUR',
          );
          totalAvailableEUR += conv.convertedAmount;
        }

        // Convert hold balances to EUR
        const xafHold = Number(wallet.hold_balance_xaf) || 0;
        const usdHold = Number(wallet.hold_balance_usd) || 0;
        const eurHold = Number(wallet.hold_balance_eur) || 0;
        const cadHold = Number(wallet.hold_balance_cad) || 0;

        if (xafHold > 0) {
          const conv = this.currencyService.convertCurrency(
            xafHold,
            'XAF',
            'EUR',
          );
          totalHoldEUR += conv.convertedAmount;
        }
        if (usdHold > 0) {
          const conv = this.currencyService.convertCurrency(
            usdHold,
            'USD',
            'EUR',
          );
          totalHoldEUR += conv.convertedAmount;
        }
        totalHoldEUR += eurHold;
        if (cadHold > 0) {
          const conv = this.currencyService.convertCurrency(
            cadHold,
            'CAD',
            'EUR',
          );
          totalHoldEUR += conv.convertedAmount;
        }
      }

      totalAvailableEUR = Math.round(totalAvailableEUR * 100) / 100;
      totalHoldEUR = Math.round(totalHoldEUR * 100) / 100;

      // For wallet balances, we only have current totals
      // Monthly increases are set to 0 since we don't track historical balance snapshots
      const totalAvailableThisMonthEUR = totalAvailableEUR;
      const totalAvailableLastMonthEUR = totalAvailableEUR; // Use current as proxy
      const totalHoldThisMonthEUR = totalHoldEUR;
      const totalHoldLastMonthEUR = totalHoldEUR; // Use current as proxy

      // Get user counts
      const [
        totalUsers,
        totalUsersThisMonth,
        totalUsersLastMonth,
        totalVerifiedUsers,
        totalVerifiedUsersThisMonth,
        totalVerifiedUsersLastMonth,
      ] = await Promise.all([
        this.prisma.user.count({
          where: {
            is_deleted: false,
          },
        }),
        this.prisma.user.count({
          where: {
            is_deleted: false,
            createdAt: {
              gte: currentMonthStart,
            },
          },
        }),
        this.prisma.user.count({
          where: {
            is_deleted: false,
            createdAt: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
        }),
        this.prisma.user.count({
          where: {
            is_deleted: false,
            kycRecords: {
              some: {
                status: KYCStatus.APPROVED,
              },
            },
          },
        }),
        this.prisma.user.count({
          where: {
            is_deleted: false,
            kycRecords: {
              some: {
                status: KYCStatus.APPROVED,
                createdAt: {
                  gte: currentMonthStart,
                },
              },
            },
          },
        }),
        this.prisma.user.count({
          where: {
            is_deleted: false,
            kycRecords: {
              some: {
                status: KYCStatus.APPROVED,
                createdAt: {
                  gte: lastMonthStart,
                  lte: lastMonthEnd,
                },
              },
            },
          },
        }),
      ]);

      // Get active requests (excluding DECLINED, EXPIRED, REFUNDED, REVIEWED)
      const [
        totalActiveRequests,
        totalActiveRequestsThisMonth,
        totalActiveRequestsLastMonth,
      ] = await Promise.all([
        this.prisma.tripRequest.count({
          where: {
            status: {
              notIn: [
                RequestStatus.DECLINED,
                RequestStatus.EXPIRED,
                RequestStatus.REFUNDED,
                RequestStatus.REVIEWED,
              ],
            },
            is_deleted: false,
          },
        }),
        this.prisma.tripRequest.count({
          where: {
            status: {
              notIn: [
                RequestStatus.DECLINED,
                RequestStatus.EXPIRED,
                RequestStatus.REFUNDED,
                RequestStatus.REVIEWED,
              ],
            },
            is_deleted: false,
            created_at: {
              gte: currentMonthStart,
            },
          },
        }),
        this.prisma.tripRequest.count({
          where: {
            status: {
              notIn: [
                RequestStatus.DECLINED,
                RequestStatus.EXPIRED,
                RequestStatus.REFUNDED,
                RequestStatus.REVIEWED,
              ],
            },
            is_deleted: false,
            created_at: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
        }),
      ]);

      // Get active trips (SCHEDULED, RESCHEDULED, INPROGRESS)
      const [
        totalActiveTrips,
        totalActiveTripsThisMonth,
        totalActiveTripsLastMonth,
      ] = await Promise.all([
        this.prisma.trip.count({
          where: {
            status: {
              in: [
                TripStatus.SCHEDULED,
                TripStatus.RESCHEDULED,
                TripStatus.INPROGRESS,
              ],
            },
            is_deleted: false,
            user: {
              is_deleted: false,
            },
          },
        }),
        this.prisma.trip.count({
          where: {
            status: {
              in: [
                TripStatus.SCHEDULED,
                TripStatus.RESCHEDULED,
                TripStatus.INPROGRESS,
              ],
            },
            is_deleted: false,
            user: {
              is_deleted: false,
            },
            createdAt: {
              gte: currentMonthStart,
            },
          },
        }),
        this.prisma.trip.count({
          where: {
            status: {
              in: [
                TripStatus.SCHEDULED,
                TripStatus.RESCHEDULED,
                TripStatus.INPROGRESS,
              ],
            },
            is_deleted: false,
            user: {
              is_deleted: false,
            },
            createdAt: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
        }),
      ]);

      // Get platform fees from transactions
      // We need to get transactions with VELRO_FEE or COMMISSION source
      // that are related to requests with valid statuses
      const feeTransactions = await this.prisma.transaction.findMany({
        where: {
          source: {
            in: [TransactionSource.VELRO_FEE, TransactionSource.COMMISSION],
          },
          request: {
            status: {
              notIn: [
                RequestStatus.PENDING,
                RequestStatus.ACCEPTED,
                RequestStatus.DECLINED,
                RequestStatus.CANCELLED,
                RequestStatus.EXPIRED,
              ],
            },
          },
        },
        select: {
          amount_paid: true,
          currency: true,
        },
      });

      let totalPlatformFeeEUR = 0;
      for (const transaction of feeTransactions) {
        if (transaction.amount_paid && transaction.currency) {
          const amount = Number(transaction.amount_paid);
          const currency = String(transaction.currency);
          const conversion = this.currencyService.convertCurrency(
            amount,
            currency,
            'EUR',
          );
          totalPlatformFeeEUR += conversion.convertedAmount;
        }
      }
      totalPlatformFeeEUR = Math.round(totalPlatformFeeEUR * 100) / 100;

      // Get platform fees this month
      const feeTransactionsThisMonth = await this.prisma.transaction.findMany({
        where: {
          source: {
            in: [TransactionSource.VELRO_FEE, TransactionSource.COMMISSION],
          },
          request: {
            status: {
              notIn: [
                RequestStatus.PENDING,
                RequestStatus.ACCEPTED,
                RequestStatus.DECLINED,
                RequestStatus.CANCELLED,
                RequestStatus.EXPIRED,
              ],
            },
            created_at: {
              gte: currentMonthStart,
            },
          },
          createdAt: {
            gte: currentMonthStart,
          },
        },
        select: {
          amount_paid: true,
          currency: true,
        },
      });

      let totalPlatformFeeThisMonthEUR = 0;
      for (const transaction of feeTransactionsThisMonth) {
        if (transaction.amount_paid && transaction.currency) {
          const amount = Number(transaction.amount_paid);
          const currency = String(transaction.currency);
          const conversion = this.currencyService.convertCurrency(
            amount,
            currency,
            'EUR',
          );
          totalPlatformFeeThisMonthEUR += conversion.convertedAmount;
        }
      }
      totalPlatformFeeThisMonthEUR =
        Math.round(totalPlatformFeeThisMonthEUR * 100) / 100;

      // Get platform fees last month
      const feeTransactionsLastMonth = await this.prisma.transaction.findMany({
        where: {
          source: {
            in: [TransactionSource.VELRO_FEE, TransactionSource.COMMISSION],
          },
          request: {
            status: {
              notIn: [
                RequestStatus.PENDING,
                RequestStatus.ACCEPTED,
                RequestStatus.DECLINED,
                RequestStatus.CANCELLED,
                RequestStatus.EXPIRED,
              ],
            },
            created_at: {
              gte: lastMonthStart,
              lte: lastMonthEnd,
            },
          },
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
        select: {
          amount_paid: true,
          currency: true,
        },
      });

      let totalPlatformFeeLastMonthEUR = 0;
      for (const transaction of feeTransactionsLastMonth) {
        if (transaction.amount_paid && transaction.currency) {
          const amount = Number(transaction.amount_paid);
          const currency = String(transaction.currency);
          const conversion = this.currencyService.convertCurrency(
            amount,
            currency,
            'EUR',
          );
          totalPlatformFeeLastMonthEUR += conversion.convertedAmount;
        }
      }
      totalPlatformFeeLastMonthEUR =
        Math.round(totalPlatformFeeLastMonthEUR * 100) / 100;

      // Calculate percentage increases
      const increasePercentages = {
        totalRevenueEUR: calculatePercentageIncrease(
          totalRevenueThisMonthEUR,
          totalRevenueLastMonthEUR,
        ),
        totalAvailableWalletFundsEUR: calculatePercentageIncrease(
          totalAvailableThisMonthEUR,
          totalAvailableLastMonthEUR,
        ),
        totalHoldWalletFundsEUR: calculatePercentageIncrease(
          totalHoldThisMonthEUR,
          totalHoldLastMonthEUR,
        ),
        totalUsers: calculatePercentageIncrease(
          totalUsersThisMonth,
          totalUsersLastMonth,
        ),
        totalVerifiedUsers: calculatePercentageIncrease(
          totalVerifiedUsersThisMonth,
          totalVerifiedUsersLastMonth,
        ),
        totalActiveRequests: calculatePercentageIncrease(
          totalActiveRequestsThisMonth,
          totalActiveRequestsLastMonth,
        ),
        totalActiveTrips: calculatePercentageIncrease(
          totalActiveTripsThisMonth,
          totalActiveTripsLastMonth,
        ),
        totalPlatformFeeEUR: calculatePercentageIncrease(
          totalPlatformFeeThisMonthEUR,
          totalPlatformFeeLastMonthEUR,
        ),
      };

      const message = await this.i18n.translate(
        'translation.admin.analyticsStatsSuccess',
        {
          lang,
          defaultValue: 'Analytics statistics retrieved successfully',
        },
      );

      return {
        message,
        stats: {
          totalRevenueEUR,
          totalAvailableWalletFundsEUR: totalAvailableEUR,
          totalHoldWalletFundsEUR: totalHoldEUR,
          totalUsers,
          totalVerifiedUsers,
          totalActiveRequests,
          totalActiveTrips,
          totalPlatformFeeEUR,
          increasePercentages,
        },
      };
    } catch (error) {
      console.error('Error getting admin analytics statistics:', error);
      const message = await this.i18n.translate(
        'translation.admin.analyticsStatsFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve analytics statistics',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get users ranking by trip revenue
   */
  async getAdminUsersRanking(
    query: AdminUsersRankingQueryDto,
    lang?: string,
  ): Promise<AdminUsersRankingResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      // Get all users (excluding deleted)
      const allUsers = await this.prisma.user.findMany({
        where: {
          is_deleted: false,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      const userIds = allUsers.map((u) => u.id);

      if (userIds.length === 0) {
        const message = await this.i18n.translate(
          'translation.admin.usersRankingSuccess',
          {
            lang,
            defaultValue: 'Users ranking retrieved successfully',
          },
        );
        return {
          message,
          users: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      // Get all trips for these users (excluding deleted trips)
      const allTrips = await this.prisma.trip.findMany({
        where: {
          user_id: { in: userIds },
          is_deleted: false,
        },
        select: {
          id: true,
          user_id: true,
          status: true,
        },
      });

      const tripIds = allTrips.map((t) => t.id);

      // Get all requests on these trips (excluding deleted requests)
      const allRequests =
        tripIds.length > 0
          ? await this.prisma.tripRequest.findMany({
              where: {
                trip_id: { in: tripIds },
                is_deleted: false,
              },
              select: {
                id: true,
                trip_id: true,
                status: true,
                cost: true,
                currency: true,
              },
            })
          : [];

      // Get completed trips count per user
      const completedTripsCounts = await this.prisma.trip.groupBy({
        by: ['user_id'],
        where: {
          user_id: { in: userIds },
          status: TripStatus.COMPLETED,
          is_deleted: false,
        },
        _count: {
          id: true,
        },
      });

      const completedTripsMap = new Map<string, number>();
      completedTripsCounts.forEach((item) => {
        completedTripsMap.set(item.user_id, item._count.id);
      });

      // Get average ratings per user
      const ratingsData = await this.prisma.rating.groupBy({
        by: ['receiver_id'],
        where: {
          receiver_id: { in: userIds },
        },
        _avg: {
          rating: true,
        },
      });

      const ratingsMap = new Map<string, number | null>();
      ratingsData.forEach((item) => {
        ratingsMap.set(item.receiver_id, item._avg.rating || null);
      });

      // Create a map of trip_id to user_id
      const tripToUserMap = new Map<string, string>();
      allTrips.forEach((trip) => {
        tripToUserMap.set(trip.id, trip.user_id);
      });

      // Group requests by user (via trip)
      const userRequestsMap = new Map<string, typeof allRequests>();
      allRequests.forEach((request) => {
        const userId = tripToUserMap.get(request.trip_id);
        if (userId) {
          if (!userRequestsMap.has(userId)) {
            userRequestsMap.set(userId, []);
          }
          userRequestsMap.get(userId)!.push(request);
        }
      });

      // Calculate metrics for each user
      const userRankings = allUsers.map((user) => {
        const userRequests = userRequestsMap.get(user.id) || [];
        const totalRequests = userRequests.length;
        const successfulRequests = userRequests.filter(
          (req) =>
            req.status === RequestStatus.DELIVERED ||
            req.status === RequestStatus.REVIEWED,
        ).length;

        // Calculate success rate
        const successRate =
          totalRequests > 0
            ? Math.round((successfulRequests / totalRequests) * 100 * 100) / 100
            : 0;

        // Calculate total revenue in EUR (excluding PENDING, ACCEPTED, DECLINED, CANCELLED, REFUNDED)
        let totalRevenueEUR = 0;
        const validStatusRequests = userRequests.filter(
          (req) =>
            req.status !== RequestStatus.PENDING &&
            req.status !== RequestStatus.ACCEPTED &&
            req.status !== RequestStatus.DECLINED &&
            req.status !== RequestStatus.CANCELLED &&
            req.status !== RequestStatus.REFUNDED &&
            req.cost !== null &&
            req.currency !== null,
        );

        for (const request of validStatusRequests) {
          const cost = Number(request.cost);
          const currency = String(request.currency);
          const conversion = this.currencyService.convertCurrency(
            cost,
            currency,
            'EUR',
          );
          totalRevenueEUR += conversion.convertedAmount;
        }
        totalRevenueEUR = Math.round(totalRevenueEUR * 100) / 100;

        // Get completed trips count
        const completedTripsCount = completedTripsMap.get(user.id) || 0;

        // Get average rating
        const rating = ratingsMap.get(user.id) || null;

        return {
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          completedTripsCount,
          successRate,
          totalRevenueEUR,
          rating,
        };
      });

      // Sort by total revenue (descending)
      userRankings.sort((a, b) => b.totalRevenueEUR - a.totalRevenueEUR);

      // Get total count for pagination
      const total = userRankings.length;
      const totalPages = Math.ceil(total / limit);

      // Apply pagination
      const paginatedUsers = userRankings.slice(skip, skip + limit);

      const message = await this.i18n.translate(
        'translation.admin.usersRankingSuccess',
        {
          lang,
          defaultValue: 'Users ranking retrieved successfully',
        },
      );

      return {
        message,
        users: paginatedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      console.error('Error getting users ranking:', error);
      const message = await this.i18n.translate(
        'translation.admin.usersRankingFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve users ranking',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get request status distribution (count of requests per status)
   */
  async getAdminRequestStatusDistribution(
    lang?: string,
  ): Promise<AdminRequestStatusDistributionResponseDto> {
    try {
      // Group requests by status and count
      const requestsByStatus = await this.prisma.tripRequest.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      });

      // Convert to response format
      const statusDistribution = requestsByStatus
        .map((item) => ({
          status: item.status,
          count: item._count.id,
        }))
        .sort((a, b) => {
          // Sort by status name alphabetically for consistency
          return a.status.localeCompare(b.status);
        });

      const message = await this.i18n.translate(
        'translation.admin.requestStatusDistributionSuccess',
        {
          lang,
          defaultValue: 'Request status distribution retrieved successfully',
        },
      );

      return {
        message,
        statusDistribution,
      };
    } catch (error) {
      console.error('Error getting request status distribution:', error);
      const message = await this.i18n.translate(
        'translation.admin.requestStatusDistributionFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve request status distribution',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }
}
