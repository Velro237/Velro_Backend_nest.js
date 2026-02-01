import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateShippingRequestDto } from './dto/create-shipping-request.dto';
import { ShippingRequestStatus } from 'generated/prisma';
import { GetShippingRequestsQueryDto } from './dto/get-shipping-requests-query.dto';
import { UpdateShippingRequestDto } from './dto/update-shipping-request.dto';

@Injectable()
export class ShippingRequestService {
  private readonly logger = new Logger(ShippingRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(
    userId: string,
    dto: CreateShippingRequestDto,
    file?: Express.Multer.File,
  ) {
    const photoUrls: string[] = [];

    if (file) {
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new BadRequestException('File too large (max 5MB)');
      }

      const upload = await this.cloudinaryService.uploadImage(
        file,
        'shipping-requests',
      );

      photoUrls.push(upload.secure_url);
    }

    const shipping = await this.prisma.shippingRequest.create({
      data: {
        user_id: userId,
        category: dto.category,
        package_photo_urls: photoUrls,
        package_description: dto.packageDescription,
        details_description: dto.detailsDescription,
        from: dto.from,
        to: dto.to,
        delivery_timeframe: dto.deliveryTimeframe,
        weight: dto.weight,
        packaging: dto.packaging ?? false,
        traveler_reward: dto.travelerReward,
        status: ShippingRequestStatus.PUBLISHED,
      },
    });

    return shipping;
  }

  async getMine(userId: string, query: GetShippingRequestsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { user_id: userId };
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.shippingRequest.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.shippingRequest.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, userId?: string) {
    const request = await this.prisma.shippingRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException({ code: 'SHIPPING_REQUEST_NOT_FOUND' });
    }

    const isOwner = request.user_id === userId;
    if (!isOwner && request.status !== ShippingRequestStatus.PUBLISHED) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_TO_VIEW_SHIPPING_REQUEST',
      });
    }

    return request;
  }

  async update(
    userId: string,
    requestId: string,
    dto: UpdateShippingRequestDto,
    file?: Express.Multer.File,
  ) {
    const request = await this.prisma.shippingRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException({ code: 'SHIPPING_REQUEST_NOT_FOUND' });
    }

    if (request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    if (request.status !== ShippingRequestStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'CANNOT_EDIT_REQUEST',
        message: 'Only published requests can be updated',
      });
    }

    const data: Record<string, unknown> = {};
    if (dto.category) data.category = dto.category;
    if (dto.packageDescription) data.package_description = dto.packageDescription;
    if (dto.detailsDescription !== undefined)
      data.details_description = dto.detailsDescription;
    if (dto.from) data.from = dto.from;
    if (dto.to) data.to = dto.to;
    if (dto.deliveryTimeframe)
      data.delivery_timeframe = dto.deliveryTimeframe;
    if (dto.weight) data.weight = dto.weight;
    if (dto.packaging !== undefined) data.packaging = dto.packaging;
    if (dto.travelerReward !== undefined)
      data.traveler_reward = dto.travelerReward;

    if (file) {
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new BadRequestException('File too large (max 5MB)');
      }
      const upload = await this.cloudinaryService.uploadImage(
        file,
        'shipping-requests',
      );
      const existing = request.package_photo_urls || [];
      data.package_photo_urls = [...existing, upload.secure_url];
    }

    const updated = await this.prisma.shippingRequest.update({
      where: { id: requestId },
      data,
    });
    return updated;
  }

  async remove(userId: string, requestId: string) {
    const request = await this.prisma.shippingRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException({ code: 'SHIPPING_REQUEST_NOT_FOUND' });
    }

    if (request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    const forbiddenStatuses: ShippingRequestStatus[] = [
      ShippingRequestStatus.DELIVERED,
      ShippingRequestStatus.COMPLETED,
      ShippingRequestStatus.CANCELLED,
      ShippingRequestStatus.EXPIRED,
    ];

    if (forbiddenStatuses.includes(request.status)) {
      throw new BadRequestException({
        code: 'CANNOT_CANCEL_REQUEST',
        message: 'Request cannot be cancelled in its current status',
      });
    }

    const updated = await this.prisma.shippingRequest.update({
      where: { id: requestId },
      data: { status: ShippingRequestStatus.CANCELLED },
    });
    return updated;
  }
}
