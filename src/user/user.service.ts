import {
  ConflictException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
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
import {
  CreateRatingDto,
  CreateRatingResponseDto,
} from './dto/create-rating.dto';
import {
  GetUserRatingsQueryDto,
  GetUserRatingsResponseDto,
} from './dto/get-user-ratings.dto';
import { UserStatsResponseDto } from './dto/user-stats.dto';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
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

    const exists = await this.prisma.user.findUnique({ where: { email } });
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
      },
      select: userSelect,
    });

    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // Helper function to trim string values (except password)
    const trimValue = (key: string, value: any): any => {
      if (key === 'password' || typeof value !== 'string') {
        return value;
      }
      return value.trim();
    };

    // Trim all string fields in the DTO
    const trimmedDto: any = {};
    for (const [key, value] of Object.entries(updateUserDto)) {
      trimmedDto[key] = trimValue(key, value);
    }

    const { email, password, date_of_birth, services, cities, ...rest } =
      trimmedDto;

    // Validate email uniqueness with trimmed email
    if (email) {
      const dup = await this.prisma.user.findUnique({
        where: { email },
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

        // Update user with all fields
        return await prisma.user.update({
          where: { id },
          data: {
            ...rest,
            ...(email ? { email } : {}),
            ...(hashed ? { password: hashed } : {}),
            ...(dateOfBirth ? { date_of_birth: dateOfBirth } : {}),
            ...(servicesData ? { services: servicesData } : {}),
            ...(citiesData ? { cities: citiesData } : {}),
          },
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

  async remove(id: string) {
    try {
      const user = await this.prisma.user.delete({
        where: { id },
        select: userSelect,
      });
      return user;
    } catch (e) {
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
      if (userId === reported_id) {
        const message = await this.i18n.translate(
          'translation.report.cannotReportSelf',
          { lang },
        );
        throw new ConflictException(message);
      }

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

      const message = await this.i18n.translate(
        'translation.rating.getUserRatingsSuccess',
        { lang },
      );

      return {
        message,
        ratings: ratingSummaries,
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
}
