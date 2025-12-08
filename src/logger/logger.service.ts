import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetLogsQueryDto, GetLogsResponseDto } from './dto/get-logs.dto';
import { loggerType } from 'generated/prisma';

@Injectable()
export class LoggerService {
  constructor(private readonly prisma: PrismaService) {}

  async getLogsByUserId(
    userId: string,
    query: GetLogsQueryDto,
  ): Promise<GetLogsResponseDto> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const type = query.type || 'ALL';

    // Build where clause
    const where: any = {
      user_id: userId,
    };

    // Filter by type if not ALL
    if (type !== 'ALL') {
      where.type = type;
    }

    // Get total count
    const total = await this.prisma.logger.count({ where });

    // Get logs with pagination
    const logs = await this.prisma.logger.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      logs,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
