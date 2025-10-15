import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../../notification/notification.service';
import { I18nService } from 'nestjs-i18n';
import { randomInt, randomBytes } from 'crypto';
import * as dayjs from 'dayjs';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Generate a unique 6-digit OTP code
   */
  private generateOtpCode(): string {
    return randomInt(100000, 999999).toString();
  }

  /**
   * Generate a unique access key (32 bytes = 64 hex characters)
   */
  private generateAccessKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create a new OTP and store it in database
   * @param email - User's email
   * @param type - Type of OTP (LOGIN, SIGNUP, FORGOT_PASSWORD, VERIFY_EMAIL)
   * @param phone - Optional phone number
   * @returns The created OTP record
   */
  async createOtp(
    email: string,
    type: 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'VERIFY_EMAIL',
    phone?: string,
  ) {
    // Generate unique 6-digit code
    const code = this.generateOtpCode();

    // Set expiration to 10 minutes from now
    const expiresAt = dayjs().add(10, 'minute').toDate();

    // Delete any existing non-verified OTPs for this email/type
    await this.prisma.otp.deleteMany({
      where: {
        email,
        type,
        verified: false,
      },
    });

    // Create new OTP
    const otp = await this.prisma.otp.create({
      data: {
        code,
        email,
        phone,
        type,
        expiresAt,
        verified: false,
      },
    });

    return otp;
  }

  /**
   * Send OTP via email using Notification Service
   * @param email - Recipient email
   * @param code - OTP code to send
   * @param type - Type of OTP for email template
   * @param lang - Language for translations
   */
  async sendOtpEmail(
    email: string,
    code: string,
    type: 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'VERIFY_EMAIL',
    lang: string = 'en',
  ): Promise<void> {
    try {
      let subject = '';
      let htmlContent = '';

      switch (type) {
        case 'SIGNUP':
        case 'VERIFY_EMAIL':
          subject = await this.i18n.translate(
            'translation.otp.email.verifyEmail.subject',
            { lang },
          );
          const verifyTitle = await this.i18n.translate(
            'translation.otp.email.verifyEmail.welcome',
            { lang },
          );
          const verifyCodeLabel = await this.i18n.translate(
            'translation.otp.email.verifyEmail.codeLabel',
            { lang },
          );
          const verifyExpiry = await this.i18n.translate(
            'translation.otp.email.verifyEmail.expiry',
            { lang },
          );
          const verifyIgnore = await this.i18n.translate(
            'translation.otp.email.verifyEmail.ignore',
            { lang },
          );

          htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${verifyTitle}</h2>
              <p>${verifyCodeLabel}</p>
              <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${code}
              </div>
              <p>${verifyExpiry}</p>
              <p>${verifyIgnore}</p>
            </div>
          `;
          break;

        case 'LOGIN':
          subject = await this.i18n.translate(
            'translation.otp.email.login.subject',
            { lang },
          );
          const loginTitle = await this.i18n.translate(
            'translation.otp.email.login.title',
            { lang },
          );
          const loginCodeLabel = await this.i18n.translate(
            'translation.otp.email.login.codeLabel',
            { lang },
          );
          const loginExpiry = await this.i18n.translate(
            'translation.otp.email.login.expiry',
            { lang },
          );
          const loginWarning = await this.i18n.translate(
            'translation.otp.email.login.warning',
            { lang },
          );

          htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${loginTitle}</h2>
              <p>${loginCodeLabel}</p>
              <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${code}
              </div>
              <p>${loginExpiry}</p>
              <p>${loginWarning}</p>
            </div>
          `;
          break;

        case 'FORGOT_PASSWORD':
          subject = await this.i18n.translate(
            'translation.otp.email.forgotPassword.subject',
            { lang },
          );
          const forgotTitle = await this.i18n.translate(
            'translation.otp.email.forgotPassword.title',
            { lang },
          );
          const forgotCodeLabel = await this.i18n.translate(
            'translation.otp.email.forgotPassword.codeLabel',
            { lang },
          );
          const forgotExpiry = await this.i18n.translate(
            'translation.otp.email.forgotPassword.expiry',
            { lang },
          );
          const forgotIgnore = await this.i18n.translate(
            'translation.otp.email.forgotPassword.ignore',
            { lang },
          );

          htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">${forgotTitle}</h2>
              <p>${forgotCodeLabel}</p>
              <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${code}
              </div>
              <p>${forgotExpiry}</p>
              <p>${forgotIgnore}</p>
            </div>
          `;
          break;
      }

      // Send email via Notification Service
      await this.notificationService.sendEmail(
        {
          to: email,
          subject,
          html: htmlContent,
        },
        lang,
      );

      console.log(`OTP email sent successfully to ${email}`);
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      const message = await this.i18n.translate('translation.otp.sendFailed', {
        lang,
        defaultValue: 'Failed to send verification email',
      });
      throw new BadRequestException(message);
    }
  }

  /**
   * Verify OTP code and generate access key
   * @param email - User's email
   * @param code - OTP code to verify
   * @param type - Type of OTP
   * @param lang - Language for translations
   * @returns The verified OTP record with access key
   */
  async verifyOtp(
    email: string,
    code: string,
    type: 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'VERIFY_EMAIL',
    lang: string = 'en',
  ) {
    // Find the OTP
    const otp = await this.prisma.otp.findFirst({
      where: {
        email,
        code,
        type,
        verified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otp) {
      const message = await this.i18n.translate('translation.otp.invalid', {
        lang,
        defaultValue: 'Invalid or expired OTP code',
      });
      throw new UnauthorizedException(message);
    }

    // Check if OTP has expired
    if (dayjs().isAfter(dayjs(otp.expiresAt))) {
      const message = await this.i18n.translate('translation.otp.expired', {
        lang,
        defaultValue: 'OTP code has expired',
      });
      throw new UnauthorizedException(message);
    }

    // Generate unique access key
    const accessKey = this.generateAccessKey();

    // Mark OTP as verified and store access key
    const verifiedOtp = await this.prisma.otp.update({
      where: {
        id: otp.id,
      },
      data: {
        verified: true,
        access_key: accessKey,
      },
    });

    return verifiedOtp;
  }

  /**
   * Verify if access key exists in database
   * @param accessKey - The access key to verify
   * @param email - The email associated with the access key
   * @param type - Optional: Type of OTP to verify against
   * @param lang - Language for translations
   * @returns The OTP record if found
   */
  async verifyAccessKey(
    accessKey: string,
    email: string,
    type?: 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'VERIFY_EMAIL',
    lang: string = 'en',
  ) {
    // Find OTP with this access key
    const otp = await this.prisma.otp.findUnique({
      where: {
        access_key: accessKey,
      },
    });

    if (!otp) {
      const message = await this.i18n.translate(
        'translation.otp.accessKey.invalid',
        {
          lang,
          defaultValue: 'Invalid access key',
        },
      );
      throw new UnauthorizedException(message);
    }

    // Check if email matches
    if (otp.email !== email) {
      const message = await this.i18n.translate(
        'translation.otp.accessKey.emailMismatch',
        {
          lang,
          defaultValue: 'Access key does not belong to this email',
        },
      );
      throw new UnauthorizedException(message);
    }

    // Check if it matches the type if specified
    if (type && otp.type !== type) {
      const message = await this.i18n.translate(
        'translation.otp.accessKey.invalidType',
        {
          lang,
          defaultValue: 'Invalid access key for this operation',
        },
      );
      throw new UnauthorizedException(message);
    }

    // Check if OTP was verified
    if (!otp.verified) {
      const message = await this.i18n.translate(
        'translation.otp.accessKey.notVerified',
        {
          lang,
          defaultValue: 'Access key not verified',
        },
      );
      throw new UnauthorizedException(message);
    }

    // Check if OTP has expired
    if (dayjs().isAfter(dayjs(otp.expiresAt))) {
      const message = await this.i18n.translate(
        'translation.otp.accessKey.expired',
        {
          lang,
          defaultValue: 'Access key has expired',
        },
      );
      throw new UnauthorizedException(message);
    }

    return otp;
  }

  /**
   * Invalidate access key (delete the OTP record)
   * @param accessKey - The access key to invalidate
   * @param lang - Language for translations
   */
  async invalidateAccessKey(accessKey: string, lang: string = 'en') {
    const deleted = await this.prisma.otp.delete({
      where: {
        access_key: accessKey,
      },
    });

    const message = await this.i18n.translate(
      'translation.otp.accessKey.invalidated',
      {
        lang,
        defaultValue: 'Access key invalidated successfully',
      },
    );

    return {
      message,
      invalidated: true,
    };
  }

  /**
   * Create and send OTP in one step
   * @param email - User's email
   * @param type - Type of OTP
   * @param phone - Optional phone number
   * @param lang - Language for translations
   * @returns The OTP code (for development/testing purposes)
   */
  async createAndSendOtp(
    email: string,
    type: 'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'VERIFY_EMAIL',
    phone?: string,
    lang: string = 'en',
  ) {
    // Create OTP
    const otp = await this.createOtp(email, type, phone);

    // Send OTP email
    await this.sendOtpEmail(email, otp.code, type, lang);

    // In production, don't return the code
    // For development/testing, you can return it
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    const message = await this.i18n.translate('translation.otp.sent', {
      lang,
      defaultValue: 'OTP sent successfully',
    });

    return {
      message,
      email,
      expiresAt: otp.expiresAt,
      // Only include code in development
      ...(isDevelopment && { code: otp.code }),
    };
  }

  /**
   * Clean up expired OTPs (can be called by a cron job)
   */
  async cleanupExpiredOtps() {
    const deleted = await this.prisma.otp.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    console.log(`Cleaned up ${deleted.count} expired OTPs`);
    return deleted;
  }
}
