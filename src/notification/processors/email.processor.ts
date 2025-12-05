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
      const email = job?.data?.email || 'Unknown';
      const errorDetails = this.extractErrorDetails(err, email, job);

      this.logger.error(
        `Job failed after all retries for ${email} | ` +
          `Status: ${errorDetails.statusCode} | ` +
          `Error: ${errorDetails.errorMessage} | ` +
          `Type: ${errorDetails.errorType} | ` +
          `Details: ${errorDetails.details} | ` +
          `Total Attempts: ${job?.attemptsMade || 0}`,
        {
          email,
          jobId: job?.id,
          attemptsMade: job?.attemptsMade,
          maxAttempts: job?.opts?.attempts,
          statusCode: errorDetails.statusCode,
          errorMessage: errorDetails.errorMessage,
          errorType: errorDetails.errorType,
          details: errorDetails.details,
          mailgunResponse: errorDetails.mailgunResponse,
          failedReason: err.message,
        },
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
   * Extract detailed error information from Mailgun API error response
   */
  private extractErrorDetails(
    error: any,
    email: string,
    job?: Job<EmailJobData>,
  ): {
    statusCode: number | string;
    errorMessage: string;
    errorType: string;
    details: string;
    mailgunResponse: any;
    attemptInfo: string;
  } {
    let statusCode: number | string = 'Unknown';
    let errorMessage = error?.message || 'Unknown error';
    let errorType = 'Unknown';
    let details = 'No additional details available';
    let mailgunResponse: any = null;
    let attemptInfo = '';

    // Extract attempt information from job if available
    if (job) {
      const attemptsMade = job.attemptsMade || 0;
      const maxAttempts = job.opts?.attempts || 3;
      attemptInfo = `Attempt ${attemptsMade + 1}/${maxAttempts}`;
    }

    // Extract HTTP status code
    if (error?.status || error?.statusCode) {
      statusCode = error.status || error.statusCode;
    } else if (error?.response?.status) {
      statusCode = error.response.status;
    } else if (error?.statusCode) {
      statusCode = error.statusCode;
    }

    // Extract Mailgun API error response
    if (error?.response?.data) {
      mailgunResponse = error.response.data;

      // Mailgun error structure: { message: string }
      if (mailgunResponse.message) {
        errorMessage = mailgunResponse.message;
        details = `Mailgun API Error: ${mailgunResponse.message}`;
      }

      // Check for additional error fields
      if (mailgunResponse.error) {
        errorType = mailgunResponse.error;
        details = `${details} | Error Type: ${mailgunResponse.error}`;
      }
    } else if (error?.body) {
      // Some Mailgun SDK versions return error in body
      mailgunResponse = error.body;
      if (typeof mailgunResponse === 'string') {
        try {
          mailgunResponse = JSON.parse(mailgunResponse);
          if (mailgunResponse.message) {
            errorMessage = mailgunResponse.message;
            details = `Mailgun API Error: ${mailgunResponse.message}`;
          }
        } catch {
          details = mailgunResponse;
        }
      } else if (mailgunResponse.message) {
        errorMessage = mailgunResponse.message;
        details = `Mailgun API Error: ${mailgunResponse.message}`;
      }
    }

    // Determine error type based on status code
    if (typeof statusCode === 'number') {
      if (statusCode >= 400 && statusCode < 500) {
        errorType = 'Client Error';
        if (statusCode === 401) {
          details = `${details} | Authentication failed - check API key`;
        } else if (statusCode === 403) {
          details = `${details} | Forbidden - check domain permissions`;
        } else if (statusCode === 404) {
          details = `${details} | Domain not found - check domain configuration`;
        } else if (statusCode === 429) {
          details = `${details} | Rate limit exceeded - too many requests`;
        }
      } else if (statusCode >= 500) {
        errorType = 'Server Error';
        details = `${details} | Mailgun server error - may be temporary`;
      }
    }

    // Extract request details if available
    if (error?.request) {
      details = `${details} | Request URL: ${error.request.url || 'N/A'}`;
    }

    // Add email validation hint for common errors
    if (
      errorMessage.toLowerCase().includes('invalid') ||
      errorMessage.toLowerCase().includes('email') ||
      statusCode === 400
    ) {
      details = `${details} | Email address: ${email}`;
    }

    return {
      statusCode,
      errorMessage,
      errorType,
      details,
      mailgunResponse,
      attemptInfo,
    };
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

    // Select content based on user language with fallback to English
    // Fallback language is always English (not French)
    let subject: string;
    let text: string | undefined;
    let html: string | undefined;
    let finalLang = userLang;

    if (userLang === 'fr') {
      // User prefers French - try French first, fallback to English
      subject = subject_fr || subject_en;
      text = text_fr || text_en;
      html = html_fr || html_en;
      // If we had to use English content, update the language
      if (!text_fr && !html_fr) {
        finalLang = 'en';
      }
    } else {
      // User prefers English (or default) - use English only
      // No fallback to French, English is the default fallback language
      subject = subject_en;
      text = text_en;
      html = html_en;
      finalLang = 'en';
    }

    // Validate that either text or html is provided (after fallback)
    if (!text && !html) {
      throw new Error(
        `Either text or html content must be provided for at least one language (en or fr)`,
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
        `Email sent successfully to ${email} in ${finalLang} language (user preferred: ${userLang})`,
      );
    } catch (error: any) {
      // Extract detailed error information from Mailgun API response
      const errorDetails = this.extractErrorDetails(error, email, job);

      // Log comprehensive error information
      this.logger.error(
        `Failed to send email to ${email} | ` +
          `Status: ${errorDetails.statusCode} | ` +
          `Error: ${errorDetails.errorMessage} | ` +
          `Type: ${errorDetails.errorType} | ` +
          `Details: ${errorDetails.details} | ` +
          `Attempt: ${errorDetails.attemptInfo}`,
        {
          email,
          jobId: job.id,
          statusCode: errorDetails.statusCode,
          errorMessage: errorDetails.errorMessage,
          errorType: errorDetails.errorType,
          details: errorDetails.details,
          mailgunResponse: errorDetails.mailgunResponse,
          attemptsMade: job.attemptsMade,
          stack: error.stack,
        },
      );

      throw error; // Re-throw to trigger retry mechanism
    }
  }
}
