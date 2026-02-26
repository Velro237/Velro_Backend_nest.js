import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { map, Observable, of } from 'rxjs';
import { RedisService } from '../redis.service';
import { Reflector } from '@nestjs/core';
import { RedisTTL } from '../decorators/redis-ttl.decorator';
import { TimeMs } from 'src/shared/utils';

export interface CachedResponse<T> {
  meta: {
    cacheHit: boolean;
    cachedAt: Date;
    validUntil: Date;
  };
  data: T;
}

@Injectable()
export class RedisCacheInterceptor<T>
  implements NestInterceptor<T, CachedResponse<T>>
{
  private readonly logger: Logger;

  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {
    this.logger = new Logger(RedisCacheInterceptor.name);
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<CachedResponse<T>>> {
    const ctx = context.switchToHttp();
    const request: Request = ctx.getRequest();
    const key = request.originalUrl;

    const ttlSec = Math.max(
      0,
      this.reflector.get<number>(RedisTTL, context.getHandler()) || 60,
    );

    const cachedResponse = await this.redisService.get(key);
    if (cachedResponse) {
      this.logger.debug(`Cache hit. Key: ${key}`);
      const data: CachedResponse<T> = JSON.parse(cachedResponse);

      if (data.meta) {
        data.meta.cacheHit = true;
      }

      return of(data);
    }

    this.logger.debug(`Cache miss. Key: ${key}`);

    return next.handle().pipe(
      map((data: T) => {
        const now = new Date();
        const validUntil = new Date(now.getTime() + TimeMs.seconds(ttlSec));
        const meta = { cacheHit: false, cachedAt: now, validUntil };

        // Sett the cache (Fallable)
        this.redisService
          .set(key, JSON.stringify({ data, meta }), ttlSec)
          .then(() => this.logger.debug(`Cache set. Key: ${key}`))
          .catch((error) => this.logger.error(error));

        return {
          data,
          meta,
        };
      }),
    );
  }
}
