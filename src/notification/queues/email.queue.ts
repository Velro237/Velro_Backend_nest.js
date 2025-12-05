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

  /**
   * Reset queue statistics by clearing completed and failed jobs
   * This ensures stats only reflect the current bulk email campaign
   * Note: This does NOT clear waiting or active jobs
   */
  async resetStats(): Promise<void> {
    try {
      // Clean completed jobs in batches (remove all, regardless of age)
      // BullMQ clean() returns an array of cleaned job IDs, so we clean in batches
      // until no more jobs are returned
      const batchSize = 10000;
      let cleanedCompleted: string[];
      let cleanedFailed: string[];

      do {
        cleanedCompleted = await this.queue.clean(0, batchSize, 'completed');
      } while (cleanedCompleted.length > 0);

      do {
        cleanedFailed = await this.queue.clean(0, batchSize, 'failed');
      } while (cleanedFailed.length > 0);

      console.log(
        'Email queue stats reset: cleared all completed and failed jobs',
      );
    } catch (error) {
      console.error('Failed to reset email queue stats:', error);
      throw error;
    }
  }

  /**
   * Get all job IDs by status
   * @param status - Job status: 'waiting' | 'active' | 'completed' | 'failed'
   * @param start - Start index (for pagination)
   * @param end - End index (for pagination)
   */
  async getJobIds(
    status: 'waiting' | 'active' | 'completed' | 'failed' = 'waiting',
    start: number = 0,
    end: number = -1,
  ): Promise<string[]> {
    try {
      let jobs: any[] = [];

      switch (status) {
        case 'waiting':
          jobs = await this.queue.getWaiting(start, end);
          break;
        case 'active':
          jobs = await this.queue.getActive(start, end);
          break;
        case 'completed':
          jobs = await this.queue.getCompleted(start, end);
          break;
        case 'failed':
          jobs = await this.queue.getFailed(start, end);
          break;
      }

      // Extract job IDs from Job objects
      return jobs.map((job) => {
        if (typeof job === 'string') {
          return job;
        }
        return job?.id || job;
      });
    } catch (error) {
      console.error(`Failed to get ${status} job IDs:`, error);
      throw error;
    }
  }

  /**
   * Get all job IDs across all statuses
   */
  async getAllJobIds(
    start: number = 0,
    end: number = 100,
  ): Promise<{
    waiting: string[];
    active: string[];
    completed: string[];
    failed: string[];
    total: number;
  }> {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.getJobIds('waiting', start, end),
        this.getJobIds('active', start, end),
        this.getJobIds('completed', start, end),
        this.getJobIds('failed', start, end),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        total:
          waiting.length + active.length + completed.length + failed.length,
      };
    } catch (error) {
      console.error('Failed to get all job IDs:', error);
      throw error;
    }
  }

  /**
   * Get job details by ID
   */
  async getJobById(jobId: string): Promise<any> {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress;
      const returnValue = job.returnvalue;
      const failedReason = job.failedReason;

      return {
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: progress,
        returnValue: returnValue,
        failedReason: failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
        state: state,
      };
    } catch (error) {
      console.error(`Failed to get job ${jobId}:`, error);
      throw error;
    }
  }
}
