import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import Mailgun from 'mailgun.js';
import * as FormData from 'form-data';

interface EmailJobData {
  email: string;
  name?: string;
  lang?: string;
  subject_en: string;
  subject_fr: string;
  text_en?: string;
  text_fr?: string;
  html_en?: string;
  html_fr?: string;
}

@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailProcessor.name);
  private worker: Worker;
  private connection: Redis;
  private mailgunClient: any;

  constructor(private readonly configService: ConfigService) {
    // Initialize Mailgun client
    const mailgunApiKey = this.configService.get<string>('MAILGUN_API_KEY');
    const mailgunDomain = this.configService.get<string>('MAILGUN_DOMAIN');
    const mailgunURL = this.configService.get<string>('MAILGUN_URL');

    if (mailgunApiKey && mailgunDomain) {
      const mailgun = new Mailgun(FormData);
      this.mailgunClient = mailgun.client({
        username: 'api',
        key: mailgunApiKey,
        url: mailgunURL,
      });
    }
  }

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

    // Create worker with concurrency control (5 emails at a time)
    this.worker = new Worker<EmailJobData>(
      'email-queue',
      async (job: Job<EmailJobData>) => {
        return await this.processEmail(job);
      },
      {
        connection: this.connection,
        concurrency: 5, // Process 5 emails concurrently
        limiter: {
          max: 50, // Max 50 emails
          duration: 60000, // Per minute (respects Mailgun rate limits)
        },
      },
    );

    // Event handlers
    this.worker.on('completed', (job) => {
      this.logger.log(`Email sent successfully to ${job.data.email}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Failed to send email to ${job?.data?.email}: ${err.message}`,
      );
    });

    this.worker.on('error', (err) => {
      this.logger.error(`Email worker error: ${err.message}`);
    });

    this.logger.log('Email processor worker started');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.connection) {
      await this.connection.quit();
    }
  }

  /**
   * Process a single email job
   * Selects appropriate language based on user preference and personalizes with name
   */
  private async processEmail(job: Job<EmailJobData>): Promise<void> {
    const {
      email,
      name,
      lang = 'en',
      subject_en,
      subject_fr,
      text_en,
      text_fr,
      html_en,
      html_fr,
    } = job.data;

    if (!this.mailgunClient) {
      throw new Error('Mailgun client not initialized');
    }

    const mailgunDomain = this.configService.get<string>('MAILGUN_DOMAIN');
    const mailgunFromEmail = this.configService.get<string>(
      'MAILGUN_FROM_EMAIL',
      'Velro <noreply@velro.app>',
    );

    if (!mailgunDomain) {
      throw new Error('MAILGUN_DOMAIN not configured');
    }

    // Normalize user language (default to 'en' if not 'fr')
    const userLang = lang?.toLowerCase().trim() === 'fr' ? 'fr' : 'en';

    // Select content based on user language
    const subject = userLang === 'fr' ? subject_fr : subject_en;
    let text = userLang === 'fr' ? text_fr : text_en;
    let html = userLang === 'fr' ? html_fr : html_en;

    // Validate that either text or html is provided for the selected language
    if (!text && !html) {
      throw new Error(
        `Either text_${userLang} or html_${userLang} content must be provided`,
      );
    }

    // Personalize content with user name if provided
    const userName = name || 'there';
    if (text) {
      text = text.replace(/\{\{name\}\}/g, userName);
    }
    if (html) {
      html = html.replace(/\{\{name\}\}/g, userName);
    }

    try {
      await this.mailgunClient.messages.create(mailgunDomain, {
        from: mailgunFromEmail,
        to: email,
        subject: subject,
        text: text,
        html: html,
      });

      this.logger.debug(
        `Email sent successfully to ${email} in ${userLang} language`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send email to ${email}: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw to trigger retry mechanism
    }
  }
}
