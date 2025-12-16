/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, SignupResponseDto, VerifyEmailDto } from './dto/signup.dto';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import {
  PendingSignupDto,
  PendingSignupResponseDto,
  CheckOtpDto,
  CheckOtpResponseDto,
  CompleteSignupDto,
  CompleteSignupResponseDto,
  ResendOtpDto,
  ResendOtpResponseDto,
} from './dto/pending-signup.dto';
import {
  RequestPasswordResetDto,
  RequestPasswordResetResponseDto,
  CheckPasswordResetOtpDto,
  CheckPasswordResetOtpResponseDto,
  ResetPasswordDto,
  ResetPasswordResponseDto,
} from './dto/reset-password.dto';
import {
  CreateAccountDeleteRequestDto,
  CreateAccountDeleteRequestResponseDto,
} from './dto/account-delete-request.dto';
import {
  AdminGetDeleteRequestsQueryDto,
  AdminGetDeleteRequestsResponseDto,
} from './dto/admin-get-delete-requests.dto';
import { LogoutResponseDto } from './dto/logout.dto';

import { I18nService, I18nContext } from 'nestjs-i18n';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as dayjs from 'dayjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwksClient = require('jwks-rsa');
import {
  SendEmailDto,
  SendEmailResponseDto,
} from 'src/notification/dto/send-email.dto';
import { ConfigService } from '@nestjs/config';
import Mailgun from 'mailgun.js';
import { randomInt } from 'crypto';
import { OtpService } from './otp/otp.service';
import { NotificationService } from '../notification/notification.service';
import { CurrencyService } from '../currency/currency.service';
import { CountryDetectionService } from '../currency/country-detection.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly notificationService: NotificationService,
    private readonly currencyService: CurrencyService,
    private readonly countryDetectionService: CountryDetectionService,
  ) {}

  async sendEmail(
    emailDto: SendEmailDto,
    lang: string = 'en',
  ): Promise<SendEmailResponseDto> {
    try {
      // Get Mailgun credentials from environment variables
      const mailgunApiKey = this.configService.get<string>('MAILGUN_API_KEY');
      const mailgunDomain = this.configService.get<string>('MAILGUN_DOMAIN');
      const mailgunFromEmail = this.configService.get<string>(
        'MAILGUN_FROM_EMAIL',
        'noreply@velro.app',
      );
      const mailgunURL = this.configService.get<string>('MAILGUN_URL');

      if (!mailgunApiKey || !mailgunDomain) {
        throw new BadRequestException(
          'Mailgun credentials are not configured. Please set MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables.',
        );
      }

      // Validate that either text or html is provided
      if (!emailDto.text && !emailDto.html) {
        throw new BadRequestException(
          'Either text or html content must be provided',
        );
      }
      const mailgun = new Mailgun(FormData);
      const mg = mailgun.client({
        username: 'api',
        key: mailgunApiKey,
        // When you have an EU-domain, you must specify the endpoint:
        url: mailgunURL,
      });

      await mg.messages.create(mailgunDomain, {
        from: mailgunFromEmail,
        to: emailDto.to,
        subject: emailDto.subject,
        text: emailDto.text,
        html: emailDto.html,
      });

      const message = await this.i18n.translate(
        'translation.notification.email.sent',
        {
          lang,
          defaultValue: 'Email sent successfully',
        },
      );

      return {
        message,
      };
    } catch (error) {
      console.error('Email sending error:', error.response?.data || error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      const message = await this.i18n.translate(
        'translation.notification.email.failed',
        {
          lang,
          defaultValue: 'Failed to send email',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async signup(
    signupDto: SignupDto,
    lang?: string,
  ): Promise<SignupResponseDto> {
    const {
      email,
      password,
      role = 'USER',
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      zip,
      isFreightForwarder,
      companyAddress,
      companyName,
      currency: currencyFromDto,
    } = signupDto;

    // Determine currency: use DTO currency if provided, otherwise detect from phone number
    let currency = currencyFromDto;
    if (!currency && phone) {
      try {
        // Extract country code from phone number
        const countryCode = this.extractCountryCodeFromPhone(phone);
        if (countryCode) {
          // Get currency for the detected country
          currency =
            this.currencyService.getDisplayCurrencyForCountry(countryCode);
        }
      } catch (error) {
        // If detection fails, fall back to default
        console.error('Failed to detect currency from phone:', error);
      }
    }

    // Default to XAF if no currency could be determined
    if (!currency) {
      currency = 'XAF';
    }

    // Check if user already exists (non-deleted users only)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email,
        is_deleted: false,
      },
    });

    if (existingUser) {
      const message = await this.i18n.translate(
        'translation.auth.signup.emailExists',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    try {
      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const otpCode = randomInt(100_000, 1_000_000);

      const otpHash = await bcrypt.hash(String(otpCode), saltRounds);

      // Create the user
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
          otpCode: otpHash,
          firstName,
          name: `${firstName} ${lastName}`,
          lastName,
          phone,
          address,
          city,
          state,
          zip,
          isFreightForwarder,
          companyAddress,
          companyName,
          currency,
          last_seen: new Date(), // Set last_seen on user creation
        },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          name: true,
          lastName: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          createdAt: true,
          isFreightForwarder: true,
          companyAddress: true,
          otpCode: true,
        },
      });

      // Create initial UserKYC record with NOT_STARTED status
      await this.prisma.userKYC.create({
        data: {
          userId: user.id,
          status: 'NOT_STARTED',
          provider: 'DIDIT',
        },
      });

      // Create wallet with specified currency
      await this.prisma.wallet.create({
        data: {
          userId: user.id,
          currency: currency,
        },
      });

      const message = await this.i18n.translate(
        'translation.auth.signup.success',
        {
          lang,
        },
      );

      return {
        message,
        user: {
          ...user,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          phone: user.phone ?? null,
          address: user.address ?? null,
          city: user.city ?? null,
          state: user.state ?? null,
          zip: user.zip ?? null,
          picture: '',
          isFreightForwarder: false,
          currency,
          companyName: '',
          otpCode: user.otpCode,
          companyAddress: '',
        },
      };
    } catch (error: any) {
      console.log(error);
      const message = await this.i18n.translate(
        'translation.auth.signup.createFailed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  private fail() {
    // Message unique pour ne rien révéler
    throw new BadRequestException('Code OTP incorrect');
  }

  async verifyEmail(emailDto: VerifyEmailDto, lang: string) {
    const { userId, code } = emailDto;
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          otpCode: true,
        },
      });
      if (!user) this.fail();
      const codeVerify = await bcrypt.compare(code, user.otpCode);
      if (!codeVerify) this.fail();
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          otpCode: null, // Clear OTP after verification
        },
      });
      return { success: true, message: 'Email vérifié' };
    } catch (error) {
      console.log(error);
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        is_deleted: false,
      },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        createdAt: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        isFreightForwarder: true,
        companyName: true,
        companyAddress: true,
        picture: true,
        is_suspended: true,
        status_message_en: true,
        status_message_fr: true,
        is_deleted: true,
      },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto, lang?: string): Promise<LoginResponseDto> {
    const { email, password } = loginDto;

    // Validate user credentials
    const user = await this.validateUser(email, password);
    if (!user) {
      const message = await this.i18n.translate(
        'translation.auth.login.invalidCredentials',
        {
          lang,
        },
      );
      throw new UnauthorizedException(message);
    }

    // Check if user is suspended
    if (user.is_suspended) {
      const message = await this.i18n.translate(
        'translation.auth.login.accountSuspended',
        {
          lang,
          defaultValue: 'Your account has been suspended',
        },
      );
      throw new ForbiddenException({
        message,
        status_message_en:
          user.status_message_en || 'Your account has been suspended',
        status_message_fr:
          user.status_message_fr || 'Votre compte a été suspendu',
      });
    }

    // if (!user.emailVerify) {
    //   throw new BadRequestException('Email not verify');
    // }
    // Update user's last_seen on login
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { last_seen: new Date() },
      });
    } catch (error) {
      // Log error but don't fail the login if last_seen update fails
      console.error('Failed to update last_seen on login:', error);
    }

    // Generate JWT token
    const payload = { email: user.email, sub: user.id };
    const access_token = this.jwtService.sign(payload);

    const message = await this.i18n.translate(
      'translation.auth.login.success',
      {
        lang,
      },
    );

    return {
      message,
      access_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        phone: user.phone ?? null,
        address: user.address ?? null,
        city: user.city ?? null,
        state: user.state ?? null,
        zip: user.zip ?? null,
        isFreightForwarder: user.isFreightForwarder,
        companyName: user.companyName,
        companyAddress: user.companyAddress,
        picture: user.picture,
      },
    };
  }

  // Crée/relie le user à partir d’un profile OAuth (Google/Apple via Passport)
  async upsertUserFromOAuth(
    oauth: {
      provider: 'GOOGLE' | 'APPLE';
      providerAccountId: string;
      email: string | null;
      name: string | null;
      picture: string | null;
      accessToken?: string | null;
      refreshToken?: string | null;
      idToken?: string | null; // Apple
    },
    options: { skipOtpEmail?: boolean } = {},
  ) {
    const provider = oauth.provider;
    const { skipOtpEmail = false } = options;

    // Si on a un email, on tente de relier à un user existant (non-deleted only)
    let user = oauth.email
      ? await this.prisma.user.findFirst({
          where: {
            email: oauth.email,
            is_deleted: false,
          },
        })
      : null;

    // Sinon: tenter par account (provider+providerAccountId)
    if (!user) {
      const account = await this.prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId: oauth.providerAccountId,
          },
        },
        include: { user: true },
      });
      if (account) user = account.user;
    }

    if (!user) {
      const saltRounds = 10;
      let otpHash: string | null = null;
      let otpCode: string | null = null;

      if (!skipOtpEmail) {
        otpCode = String(randomInt(100_000, 1_000_000));
        otpHash = await bcrypt.hash(otpCode, saltRounds);
      }

      user = await this.prisma.user.create({
        data: {
          email: oauth.email,
          password: '',
          name: oauth.name,
          picture: oauth.picture,
          otpCode: otpHash,
          last_seen: new Date(), // Set last_seen on user creation
        },
      });

      if (!skipOtpEmail && otpCode && user.email) {
        // Get user's language preference (default to 'en' for new OAuth users)
        const userLang = user.lang || 'en';

        const emailDto: SendEmailDto = {
          to: user.email,
          subject: 'Welcome to Velro',
          text: 'Thank you for joining Velro! We are excited to have you on board.',
          html: `<h1> Your verification code is: <strong>${otpCode}</strong></h1>`,
        };

        await this.sendEmail(emailDto, userLang);
      }

      // Create initial UserKYC record with NOT_STARTED status for OAuth users
      await this.prisma.userKYC.create({
        data: {
          userId: user.id,
          status: 'NOT_STARTED',
          provider: 'DIDIT',
        },
      });

      // Create empty wallet for new user
      await this.prisma.wallet.create({
        data: {
          userId: user.id,
          available_balance_eur: 0,
          available_balance_usd: 0,
          available_balance_cad: 0,
          available_balance_xaf: 0,
          hold_balance_eur: 0,
          hold_balance_usd: 0,
          hold_balance_cad: 0,
          hold_balance_xaf: 0,
          available_balance: 0.0,
          hold_balance: 0.0,
          total_balance: 0.0,
          state: 'BLOCKED',
          currency: 'XAF',
        },
      });
    }

    // Update user's last_seen for existing users logging in via OAuth
    if (user) {
      try {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { last_seen: new Date() },
        });
      } catch (error) {
        // Log error but don't fail the login if last_seen update fails
        console.error('Failed to update last_seen on OAuth login:', error);
      }
    }

    // Upsert Account
    await this.prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: oauth.providerAccountId,
        },
      },
      update: {
        accessToken: oauth.accessToken ?? undefined,
        refreshToken: oauth.refreshToken ?? undefined,
        idToken: oauth.idToken ?? undefined,
        expiresAt: undefined,
      },
      create: {
        provider,
        providerAccountId: oauth.providerAccountId,
        userId: user.id,
        accessToken: oauth.accessToken ?? undefined,
        refreshToken: oauth.refreshToken ?? undefined,
        idToken: oauth.idToken ?? undefined,
      },
    });

    // Generate JWT token
    const payload = { email: user.email, sub: user.id };
    const access_token = this.jwtService.sign(payload);

    const message = await this.i18n.translate(
      'translation.auth.login.success',
      {
        lang: 'fr',
      },
    );

    return {
      message,
      access_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  private signTokens(user: { id: string; email?: string | null }) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email ?? null,
    });
    const refreshTokenPlain = crypto.randomBytes(48).toString('hex');
    const expiresAt = dayjs()
      .add(parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10), 'day')
      .toDate();

    return { accessToken, refreshTokenPlain, refreshExpiresAt: expiresAt };
  }

  async issueTokens(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    // Update user's last_seen on login (OAuth)
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { last_seen: new Date() },
      });
    } catch (error) {
      // Log error but don't fail the login if last_seen update fails
      console.error('Failed to update last_seen in issueTokens:', error);
    }

    const { accessToken, refreshTokenPlain, refreshExpiresAt } =
      this.signTokens(user);

    // (Option sécurité) stocker un hash du refreshTokenPlain
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenPlain, // <— en prod, hashe ceci !
        expiresAt: refreshExpiresAt,
      },
    });
    return { accessToken, refreshToken: refreshTokenPlain };
  }

  // GOOGLE: vérifier l'id_token (profil mobile)
  async loginWithGoogleIdToken(idToken: string) {
    // Simple décodage (en prod: utilise google-auth-library pour verifyIdToken)
    const decoded: any = jwt.decode(idToken) || {};
    const sub = decoded.sub;
    const email = decoded.email || null;
    const name = decoded.name || null;
    const picture = decoded.picture || null;

    if (!sub) throw new BadRequestException('Invalid Google id_token');
    const user = await this.upsertUserFromOAuth(
      {
        provider: 'GOOGLE',
        providerAccountId: sub,
        email,
        name,
        picture,
        idToken,
      },
      {
        skipOtpEmail: true,
      },
    );

    return this.issueTokens(user.user.id);
  }

  // APPLE: vérifier l'id_token via JWKS
  async loginWithAppleIdToken(idToken: string) {
    // Decode token first to get the audience and kid
    const decoded: any = jwt.decode(idToken, { complete: true });
    if (!decoded || !decoded.header || !decoded.payload) {
      throw new BadRequestException('Invalid Apple id_token format');
    }

    const kid = decoded.header.kid;
    const tokenAudience = decoded.payload.aud; // Use the audience from the token itself

    // Build list of acceptable audiences (token's own + env var if different)
    const acceptableAudiences = [
      tokenAudience, // Primary: use the token's own audience
      process.env.APPLE_CLIENT_ID, // Fallback: env variable
    ]
      .filter(Boolean)
      .filter((aud, index, self) => self.indexOf(aud) === index); // Remove duplicates

    const client = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
    });

    const key = await client.getSigningKey(kid);
    const signingKey = key.getPublicKey();

    // Verify with acceptable audiences
    const verified = jwt.verify(idToken, signingKey, {
      algorithms: ['RS256'],
      audience:
        acceptableAudiences.length === 1
          ? acceptableAudiences[0]
          : acceptableAudiences,
      issuer: 'https://appleid.apple.com',
    }) as any;

    const sub = verified.sub;
    const email = verified.email ?? null;

    if (!sub) throw new BadRequestException('Invalid Apple id_token');

    // Extract name if user shared it (Apple sends name only on first authorization)
    // Check both decoded payload (before verification) and verified payload
    let name: string | null = null;

    // Check verified payload first (most reliable)
    if (verified.name) {
      if (typeof verified.name === 'string') {
        name = verified.name;
      } else if (verified.name.firstName || verified.name.lastName) {
        // Apple sometimes sends name as object with firstName/lastName
        const firstName = verified.name.firstName || '';
        const lastName = verified.name.lastName || '';
        name = `${firstName} ${lastName}`.trim() || null;
      }
    }

    // Also check decoded payload in case name is only in unverified token
    // (Apple includes name in the initial id_token when user first authorizes)
    if (!name && decoded.payload.name) {
      if (typeof decoded.payload.name === 'string') {
        name = decoded.payload.name;
      } else if (
        decoded.payload.name.firstName ||
        decoded.payload.name.lastName
      ) {
        const firstName = decoded.payload.name.firstName || '';
        const lastName = decoded.payload.name.lastName || '';
        name = `${firstName} ${lastName}`.trim() || null;
      }
    }

    const user = await this.upsertUserFromOAuth(
      {
        provider: 'APPLE',
        providerAccountId: sub,
        email,
        name, // Use extracted name if available, otherwise null
        picture: null,
        idToken,
      },
      {
        skipOtpEmail: true,
      },
    );

    return this.issueTokens(user.user.id);
  }

  /**
   * Create a pending user and send OTP
   */
  async createPendingUser(
    pendingSignupDto: PendingSignupDto,
    lang: string = 'en',
  ): Promise<PendingSignupResponseDto> {
    const {
      firstName,
      lastName,
      username,
      phone,
      email,
      city,
      isFreightForwarder = false,
      companyName,
      companyAddress,
      cities = [],
      services = [],
      lang: userLang,
    } = pendingSignupDto;

    // Trim all string fields
    const trimmedFirstName = firstName?.trim();
    const trimmedLastName = lastName?.trim();
    const trimmedUsername = username?.trim();
    const trimmedPhone = phone?.trim();
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedCity = city?.trim() || undefined;
    const trimmedCompanyName = companyName?.trim() || undefined;
    const trimmedCompanyAddress = companyAddress?.trim() || undefined;
    const trimmedCities = cities.map((cityData) => ({
      name: cityData.name?.trim(),
      address: cityData.address?.trim(),
      contactName: cityData.contactName?.trim(),
      contactPhone: cityData.contactPhone?.trim(),
    }));
    const trimmedServices = services.map((serviceData) => ({
      name: serviceData.name?.trim(),
      description: serviceData.description?.trim() || undefined,
    }));

    // Use lang from DTO or fallback to request lang parameter, then to 'en'
    const finalLang = userLang || lang || 'en';

    // Check if email already exists in User table (non-deleted users only)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: trimmedEmail,
        is_deleted: false,
      },
    });

    if (existingUser) {
      const message = await this.i18n.translate(
        'translation.auth.signup.emailExists',
        {
          lang: finalLang,
          defaultValue: 'Email already exists',
        },
      );
      throw new ConflictException(message);
    }

    // Validate freight forwarder requirements
    if (isFreightForwarder) {
      if (!trimmedCompanyName || !trimmedCompanyAddress) {
        const message = await this.i18n.translate(
          'translation.auth.signup.companyRequired',
          {
            lang: finalLang,
            defaultValue:
              'Company name and address are required for freight forwarders',
          },
        );
        throw new BadRequestException(message);
      }

      if (!trimmedCities || trimmedCities.length === 0) {
        const message = await this.i18n.translate(
          'translation.auth.signup.citiesRequired',
          {
            lang: finalLang,
            defaultValue:
              'At least one city is required for freight forwarders',
          },
        );
        throw new BadRequestException(message);
      }

      if (!trimmedServices || trimmedServices.length === 0) {
        const message = await this.i18n.translate(
          'translation.auth.signup.servicesRequired',
          {
            lang: finalLang,
            defaultValue:
              'At least one service is required for freight forwarders',
          },
        );
        throw new BadRequestException(message);
      }
    }

    try {
      // Create OTP first
      const otpResult = await this.otpService.createAndSendOtp(
        trimmedEmail,
        'SIGNUP',
        trimmedPhone,
        finalLang,
      );

      // Create pending user
      const pendingUser = await this.prisma.pendingUser.create({
        data: {
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: trimmedEmail,
          username: trimmedUsername,
          phone: trimmedPhone,
          city: trimmedCity,
          companyName: trimmedCompanyName,
          companyAddress: trimmedCompanyAddress,
          additionalInfo: '',
          isFreightForwarder,
          otp_id: otpResult.email, // We'll store the OTP ID here
          expiresAt: otpResult.expiresAt,
          lang: finalLang,
        },
      });

      // Create company cities if freight forwarder
      if (isFreightForwarder && trimmedCities.length > 0) {
        for (const cityData of trimmedCities) {
          await this.prisma.companyCity.create({
            data: {
              name: cityData.name,
              address: cityData.address,
              contactName: cityData.contactName,
              contactPhone: cityData.contactPhone,
              pendingUsers: {
                connect: { id: pendingUser.id },
              },
            },
          });
        }
      }

      // Create company services if freight forwarder
      if (isFreightForwarder && trimmedServices.length > 0) {
        for (const serviceData of trimmedServices) {
          await this.prisma.companyService.create({
            data: {
              name: serviceData.name,
              description: serviceData.description || undefined,
              pendingUsers: {
                connect: { id: pendingUser.id },
              },
            },
          });
        }
      }

      const message = await this.i18n.translate(
        'translation.auth.pendingSignup.success',
        {
          lang: finalLang,
          defaultValue:
            'Pending user created successfully. Please check your email for OTP.',
        },
      );

      return {
        message,
        pendingUserId: pendingUser.id,
        email: trimmedEmail,
        expiresAt: otpResult.expiresAt,
      };
    } catch (error: any) {
      console.error('Error creating pending user:', error);
      const message = await this.i18n.translate(
        'translation.auth.pendingSignup.failed',
        {
          lang: finalLang,
          defaultValue: 'Failed to create pending user',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Check OTP and return access key
   */
  async checkOtp(
    checkOtpDto: CheckOtpDto,
    lang: string = 'en',
  ): Promise<CheckOtpResponseDto> {
    const { pendingUserId, code } = checkOtpDto;

    // Find pending user
    const pendingUser = await this.prisma.pendingUser.findUnique({
      where: { id: pendingUserId },
    });

    if (!pendingUser) {
      const message = await this.i18n.translate(
        'translation.auth.pendingUser.notFound',
        {
          lang,
          defaultValue: 'Pending user not found',
        },
      );
      throw new BadRequestException(message);
    }

    // Verify OTP using OtpService
    const verifiedOtp = await this.otpService.verifyOtp(
      pendingUser.email,
      code,
      'SIGNUP',
      lang,
    );

    // Update pending user with OTP ID
    await this.prisma.pendingUser.update({
      where: { id: pendingUserId },
      data: {
        otp_id: verifiedOtp.access_key,
        expiresAt: verifiedOtp.expiresAt,
      },
    });

    const message = await this.i18n.translate('translation.auth.otp.verified', {
      lang,
      defaultValue: 'OTP verified successfully',
    });

    return {
      message,
      accessKey: verifiedOtp.access_key,
      pendingUserId,
    };
  }

  /**
   * Complete signup using access key and password
   */
  async completeSignup(
    completeSignupDto: CompleteSignupDto,
    lang: string = 'en',
  ): Promise<CompleteSignupResponseDto> {
    const { pendingUserId, accessKey, password } = completeSignupDto;

    // Verify access key
    const pendingUser = await this.prisma.pendingUser.findUnique({
      where: { id: pendingUserId },
    });

    if (!pendingUser) {
      const message = await this.i18n.translate(
        'translation.auth.pendingUser.notFound',
        {
          lang,
          defaultValue: 'Pending user not found',
        },
      );
      throw new BadRequestException(message);
    }

    // Verify access key matches
    if (pendingUser.otp_id !== accessKey) {
      const message = await this.i18n.translate(
        'translation.auth.accessKey.invalid',
        {
          lang,
          defaultValue: 'Invalid access key',
        },
      );
      throw new UnauthorizedException(message);
    }

    // Verify access key with OtpService
    await this.otpService.verifyAccessKey(
      accessKey,
      pendingUser.email,
      'SIGNUP',
      lang,
    );

    try {
      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Determine currency: detect from phone number if available
      let currency = 'XAF'; // Default to XAF
      if (pendingUser.phone) {
        try {
          // Extract country code from phone number
          const countryCode = this.extractCountryCodeFromPhone(
            pendingUser.phone,
          );
          if (countryCode) {
            // Get currency for the detected country
            currency =
              this.currencyService.getDisplayCurrencyForCountry(countryCode);
          }
        } catch (error) {
          // If detection fails, fall back to default
          console.error('Failed to detect currency from phone:', error);
        }
      }

      // Create the user
      const user = await this.prisma.user.create({
        data: {
          email: pendingUser.email,
          password: hashedPassword,
          role: 'USER',
          firstName: pendingUser.firstName,
          lastName: pendingUser.lastName,
          name: `${pendingUser.firstName} ${pendingUser.lastName}`,
          username: pendingUser.username,
          phone: pendingUser.phone,
          city: pendingUser.city,
          isFreightForwarder: pendingUser.isFreightForwarder,
          companyName: pendingUser.companyName,
          companyAddress: pendingUser.companyAddress,
          currency,
          last_seen: new Date(), // Set last_seen on user creation
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          phone: true,
          city: true,
          isFreightForwarder: true,
          role: true,
          createdAt: true,
          currency: true,
        },
      });

      // Create initial UserKYC record
      await this.prisma.userKYC.create({
        data: {
          userId: user.id,
          status: 'NOT_STARTED',
          provider: 'DIDIT',
        },
      });

      // Create wallet
      await this.prisma.wallet.create({
        data: {
          userId: user.id,
          currency: user.currency,
        },
      });

      // Transfer company cities if freight forwarder
      if (pendingUser.isFreightForwarder) {
        const companyCities = await this.prisma.companyCity.findMany({
          where: {
            pendingUsers: {
              some: { id: pendingUserId },
            },
          },
        });

        for (const city of companyCities) {
          await this.prisma.companyCity.update({
            where: { id: city.id },
            data: {
              userId: user.id,
              pendingUsers: {
                disconnect: { id: pendingUserId },
              },
              users: {
                connect: { id: user.id },
              },
            },
          });
        }
      }

      // Transfer company services if freight forwarder
      if (pendingUser.isFreightForwarder) {
        const companyServices = await this.prisma.companyService.findMany({
          where: {
            pendingUsers: {
              some: { id: pendingUserId },
            },
          },
        });

        for (const service of companyServices) {
          await this.prisma.companyService.update({
            where: { id: service.id },
            data: {
              pendingUsers: {
                disconnect: { id: pendingUserId },
              },
              users: {
                connect: { id: user.id },
              },
            },
          });
        }
      }

      // Delete pending user
      await this.prisma.pendingUser.delete({
        where: { id: pendingUserId },
      });

      // Invalidate access key
      await this.otpService.invalidateAccessKey(accessKey, lang);

      const message = await this.i18n.translate(
        'translation.auth.completeSignup.success',
        {
          lang,
          defaultValue: 'User account created successfully',
        },
      );

      return {
        message,
        user,
      };
    } catch (error: any) {
      console.error('Error completing signup:', error);
      const message = await this.i18n.translate(
        'translation.auth.completeSignup.failed',
        {
          lang,
          defaultValue: 'Failed to complete signup',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Request password reset - sends email with access key
   */
  async requestPasswordReset(
    requestPasswordResetDto: RequestPasswordResetDto,
    lang: string = 'en',
  ): Promise<RequestPasswordResetResponseDto> {
    const { email } = requestPasswordResetDto;

    // Check if user exists (non-deleted users only)
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        is_deleted: false,
      },
      select: { id: true, email: true, name: true, lang: true },
    });

    if (!user) {
      const message = await this.i18n.translate(
        'translation.auth.user.notFound',
        {
          lang,
          defaultValue: 'User not found',
        },
      );
      throw new BadRequestException(message);
    }

    try {
      // Use user's language preference for OTP email
      const userLang = user.lang || lang || 'en';

      // Use OTP service to create and send OTP
      const otpResult = await this.otpService.createAndSendOtp(
        user.email,
        'FORGOT_PASSWORD',
        undefined,
        userLang,
      );

      const message = await this.i18n.translate(
        'translation.auth.passwordReset.otpSent',
        {
          lang,
          defaultValue: 'Password reset OTP sent successfully',
        },
      );

      return { message };
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      const message = await this.i18n.translate(
        'translation.auth.passwordReset.failed',
        {
          lang,
          defaultValue: 'Failed to send password reset email',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Check OTP code and return access key for password reset
   */
  async checkPasswordResetOtp(
    checkPasswordResetOtpDto: CheckPasswordResetOtpDto,
    lang: string = 'en',
  ): Promise<CheckPasswordResetOtpResponseDto> {
    const { email, code } = checkPasswordResetOtpDto;

    // Check if user exists (non-deleted users only)
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        is_deleted: false,
      },
      select: { id: true, email: true },
    });

    if (!user) {
      const message = await this.i18n.translate(
        'translation.auth.user.notFound',
        {
          lang,
          defaultValue: 'User not found',
        },
      );
      throw new BadRequestException(message);
    }

    try {
      // Verify OTP using OtpService
      const verifiedOtp = await this.otpService.verifyOtp(
        email,
        code,
        'FORGOT_PASSWORD',
        lang,
      );

      const message = await this.i18n.translate(
        'translation.auth.passwordReset.otpVerified',
        {
          lang,
          defaultValue:
            'OTP verified successfully. Use the access key to reset your password.',
        },
      );

      return {
        message,
        accessKey: verifiedOtp.access_key!,
      };
    } catch (error: any) {
      console.error('Error verifying password reset OTP:', error);
      throw error;
    }
  }

  /**
   * Reset password using access key and new password
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
    lang: string = 'en',
  ): Promise<ResetPasswordResponseDto> {
    const { accessKey, password } = resetPasswordDto;

    try {
      // Find OTP record by access key
      const otp = await this.prisma.otp.findUnique({
        where: { access_key: accessKey },
      });

      if (!otp) {
        const message = await this.i18n.translate(
          'translation.auth.accessKey.invalid',
          {
            lang,
            defaultValue: 'Invalid access key',
          },
        );
        throw new BadRequestException(message);
      }

      // Check if OTP is expired
      if (otp.expiresAt < new Date()) {
        const message = await this.i18n.translate(
          'translation.auth.otp.expired',
          {
            lang,
            defaultValue: 'Access key has expired',
          },
        );
        throw new BadRequestException(message);
      }

      // Check if OTP is for password reset
      if (otp.type !== 'FORGOT_PASSWORD') {
        const message = await this.i18n.translate(
          'translation.auth.otp.invalidType',
          {
            lang,
            defaultValue: 'Invalid access key type',
          },
        );
        throw new BadRequestException(message);
      }

      // Find user by email (non-deleted users only)
      const user = await this.prisma.user.findFirst({
        where: {
          email: otp.email!,
          is_deleted: false,
        },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        const message = await this.i18n.translate(
          'translation.auth.user.notFound',
          {
            lang,
            defaultValue: 'User not found',
          },
        );
        throw new BadRequestException(message);
      }

      // Update user password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
        },
      });

      // Invalidate OTP
      await this.prisma.otp.update({
        where: { id: otp.id },
        data: { verified: true },
      });

      const message = await this.i18n.translate(
        'translation.auth.passwordReset.success',
        {
          lang,
          defaultValue: 'Password reset successfully',
        },
      );

      return {
        message,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    } catch (error: any) {
      console.error('Error resetting password:', error);
      const message = await this.i18n.translate(
        'translation.auth.passwordReset.failed',
        {
          lang,
          defaultValue: 'Failed to reset password',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Resend OTP for pending user
   */
  async resendOtp(
    resendOtpDto: ResendOtpDto,
    lang: string = 'en',
  ): Promise<ResendOtpResponseDto> {
    const { pendingUserId } = resendOtpDto;

    // Find pending user
    const pendingUser = await this.prisma.pendingUser.findUnique({
      where: { id: pendingUserId },
    });

    if (!pendingUser) {
      const message = await this.i18n.translate(
        'translation.auth.pendingUser.notFound',
        {
          lang,
          defaultValue: 'Pending user not found',
        },
      );
      throw new BadRequestException(message);
    }

    try {
      // Create and send new OTP
      const otpResult = await this.otpService.createAndSendOtp(
        pendingUser.email,
        'SIGNUP',
        pendingUser.phone,
        lang,
      );

      // Update pending user with new OTP ID and expiry
      await this.prisma.pendingUser.update({
        where: { id: pendingUserId },
        data: {
          otp_id: otpResult.email, // Store OTP reference
          expiresAt: otpResult.expiresAt,
        },
      });

      const message = await this.i18n.translate(
        'translation.auth.resendOtp.success',
        {
          lang,
          defaultValue: 'OTP resent successfully',
        },
      );

      return {
        message,
        email: pendingUser.email,
        expiresAt: otpResult.expiresAt,
      };
    } catch (error: any) {
      console.error('Error resending OTP:', error);
      const message = await this.i18n.translate(
        'translation.auth.resendOtp.failed',
        {
          lang,
          defaultValue: 'Failed to resend OTP',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Create account deletion request
   */
  async createAccountDeleteRequest(
    createAccountDeleteRequestDto: CreateAccountDeleteRequestDto,
    lang: string = 'en',
  ): Promise<CreateAccountDeleteRequestResponseDto> {
    const { email, reason } = createAccountDeleteRequestDto;

    // Check if user exists (non-deleted users only)
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        is_deleted: false,
      },
      select: { id: true, email: true },
    });

    if (!user) {
      const message = await this.i18n.translate(
        'translation.auth.user.notFound',
        {
          lang,
          defaultValue: 'User not found',
        },
      );
      throw new BadRequestException(message);
    }

    try {
      // Create account deletion request
      const deleteRequest = await this.prisma.accountDeleteRequest.create({
        data: {
          email,
          reason: reason || null,
          user_id: user.id,
          status: 'PENDING',
        },
      });

      // Send email notification to admin
      try {
        const adminEmail = this.configService.get<string>('ADMIN_EMAIL');

        if (adminEmail) {
          const emailSubject = 'New Account Deletion Request';
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Account Deletion Request</h2>
              <p>A new account deletion request has been submitted.</p>
              <div style="background-color: #f4f4f4; padding: 20px; margin: 20px 0; border-radius: 5px;">
                <p><strong>Request ID:</strong> ${deleteRequest.id}</p>
                <p><strong>User Email:</strong> ${email}</p>
                <p><strong>User ID:</strong> ${user.id}</p>
                <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
                <p><strong>Created At:</strong> ${deleteRequest.createdAt.toLocaleString()}</p>
                <p><strong>Status:</strong> ${deleteRequest.status}</p>
              </div>
              <p>Please review and take appropriate action.</p>
            </div>
          `;

          await this.notificationService.sendEmail(
            {
              to: adminEmail,
              subject: emailSubject,
              html: emailHtml,
            },
            'en',
          );
        }
      } catch (emailError) {
        // Log email error but don't fail the request creation
        console.error(
          'Failed to send admin notification email for account deletion request:',
          emailError,
        );
      }

      const message = await this.i18n.translate(
        'translation.auth.accountDeleteRequest.created',
        {
          lang,
          defaultValue: 'Account deletion request submitted successfully',
        },
      );

      return {
        message,
        id: deleteRequest.id,
      };
    } catch (error: any) {
      console.error('Error creating account deletion request:', error);
      const message = await this.i18n.translate(
        'translation.auth.accountDeleteRequest.failed',
        {
          lang,
          defaultValue: 'Failed to create account deletion request',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get all account delete requests (Admin only)
   */
  async getAllAccountDeleteRequests(
    query: AdminGetDeleteRequestsQueryDto,
    lang: string = 'en',
  ): Promise<AdminGetDeleteRequestsResponseDto> {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    try {
      // Build where clause
      const whereClause: any = {};
      if (status) {
        whereClause.status = status;
      }

      // Get requests with pagination
      const [requests, total] = await Promise.all([
        this.prisma.accountDeleteRequest.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.accountDeleteRequest.count({ where: whereClause }),
      ]);

      // Transform to DTO format
      const requestDtos = requests.map((request) => ({
        id: request.id,
        email: request.email,
        reason: request.reason,
        status: request.status,
        user: {
          id: request.user.id,
          email: request.user.email,
          name: request.user.name,
        },
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      }));

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.auth.accountDeleteRequest.getAll.success',
        {
          lang,
          defaultValue: 'Account delete requests retrieved successfully',
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
    } catch (error: any) {
      console.error('Error getting account delete requests:', error);
      const message = await this.i18n.translate(
        'translation.auth.accountDeleteRequest.getAll.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve account delete requests',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Extract country code from phone number
   * Similar logic to CountryDetectionService.extractCountryFromPhone
   */
  private extractCountryCodeFromPhone(phoneNumber: string): string | null {
    try {
      if (!phoneNumber) return null;

      // Remove all non-digit characters
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      // Common country code patterns (subset from CountryDetectionService)
      const countryCodes: Record<string, string> = {
        // Central Africa (XAF region)
        '237': 'CM', // Cameroon
        '236': 'CF', // Central African Republic
        '235': 'TD', // Chad
        '242': 'CG', // Republic of the Congo
        '240': 'GQ', // Equatorial Guinea
        '241': 'GA', // Gabon

        // Europe (EUR)
        '33': 'FR',
        '49': 'DE',
        '39': 'IT',
        '34': 'ES',
        '31': 'NL',
        '32': 'BE',
        '43': 'AT',
        '351': 'PT',
        '353': 'IE',
        '358': 'FI',
        '352': 'LU',
        '356': 'MT',
        '357': 'CY',
        '421': 'SK',
        '386': 'SI',
        '372': 'EE',
        '371': 'LV',
        '370': 'LT',
        '30': 'GR',
        '385': 'HR',
        '359': 'BG',
        '40': 'RO',
        '48': 'PL',
        '420': 'CZ',
        '36': 'HU',
        '44': 'GB',
        '41': 'CH',
        '47': 'NO',
        '46': 'SE',
        '45': 'DK',
        '354': 'IS',
        '376': 'AD',
        '377': 'MC',
        '378': 'SM',
        '379': 'VA',
        '423': 'LI',
        '355': 'AL',
        '389': 'MK',
        '381': 'RS',
        '382': 'ME',
        '387': 'BA',
        '383': 'XK',
        '373': 'MD',
        '380': 'UA',
        '375': 'BY',
        '7': 'RU',

        // North America
        '1': 'US', // Default to US for +1 (Canada detection requires area code)
      };

      // Check for exact matches (longest codes first to avoid false matches)
      const sortedCodes = Object.keys(countryCodes).sort(
        (a, b) => b.length - a.length,
      );

      for (const code of sortedCodes) {
        if (cleanPhone.startsWith(code)) {
          // Special handling for +1 (US/Canada)
          if (code === '1') {
            // Check for Canadian area codes
            const canadianAreaCodes = [
              '416',
              '647',
              '905',
              '289',
              '365',
              '437',
              '519',
              '226',
              '613',
              '343',
              '705',
              '249',
              '807',
              '902',
              '782',
              '506',
              '709',
              '867',
            ];
            if (cleanPhone.length >= 11) {
              const areaCode = cleanPhone.substring(1, 4);
              if (canadianAreaCodes.includes(areaCode)) {
                return 'CA'; // Canada
              }
            }
            return 'US'; // Default to US for +1
          }
          return countryCodes[code];
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to extract country from phone:', error);
      return null;
    }
  }

  /**
   * Logout user by clearing device_id
   */
  async logout(
    userId: string,
    lang: string = 'en',
  ): Promise<LogoutResponseDto> {
    try {
      // Update user to set device_id to null
      await this.prisma.user.update({
        where: { id: userId },
        data: { device_id: null },
      });

      const message = await this.i18n.translate(
        'translation.auth.logout.success',
        {
          lang,
          defaultValue: 'Logged out successfully',
        },
      );

      return {
        message,
      };
    } catch (error) {
      console.error('Error during logout:', error);
      const message = await this.i18n.translate(
        'translation.auth.logout.failed',
        {
          lang,
          defaultValue: 'Failed to logout',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }
}
