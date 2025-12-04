import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

@Injectable()
export class EmailQueue implements OnModuleInit, OnModuleDestroy {
  public queue: Queue;
  private connection: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Get Redis connection details
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    // Parse Redis URL or use defaults
    let host = 'localhost';
    let port = 6379;
    let password: string | undefined = undefined;

    try {
      const url = new URL(redisUrl);
      host = url.hostname || 'localhost';
      port = parseInt(url.port || '6379', 10);
      password = url.password || undefined;
    } catch {
      // If URL parsing fails, try to extract from string format
      const match = redisUrl.match(
        /redis:\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)/,
      );
      if (match) {
        password = match[2];
        host = match[3] || 'localhost';
        port = parseInt(match[4] || '6379', 10);
      }
    }

    // Create Redis connection for BullMQ
    this.connection = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null, // Required for BullMQ
    });

    // Create the queue
    this.queue = new Queue('email-queue', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    console.log('Email queue initialized');
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
    if (this.connection) {
      await this.connection.quit();
    }
  }

  /**
   * Add emails to the queue
   * @param users - Array of user objects with email and optional name/lang
   * @param templateData - Email template data with multilingual support
   */
  async addEmails(
    users: Array<{ email: string; name?: string; lang?: string }>,
    templateData: {
      subject_en: string;
      subject_fr: string;
      text_en?: string;
      text_fr?: string;
      html_en?: string;
      html_fr?: string;
    },
  ): Promise<number> {
    let queuedCount = 0;

    // Add each email as a separate job
    for (const user of users) {
      await this.queue.add(
        'send-email',
        {
          email: user.email,
          name: user.name,
          lang: user.lang || 'en',
          subject_en: templateData.subject_en,
          subject_fr: templateData.subject_fr,
          text_en: templateData.text_en,
          text_fr: templateData.text_fr,
          html_en: templateData.html_en,
          html_fr: templateData.html_fr,
        },
        {
          // Add delay between jobs to avoid rate limiting (100ms)
          delay: queuedCount * 100,
        },
      );
      queuedCount++;
    }

    return queuedCount;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    };
  }
}
