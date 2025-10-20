/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
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
import { I18nService, I18nContext } from 'nestjs-i18n';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as dayjs from 'dayjs';
import jwksClient from 'jwks-rsa';
import {
  SendEmailDto,
  SendEmailResponseDto,
} from 'src/notification/dto/send-email.dto';
import { ConfigService } from '@nestjs/config';
import Mailgun from 'mailgun.js';
import { randomInt } from 'crypto';
import { OtpService } from './otp/otp.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
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
      currency = 'XAF',
    } = signupDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
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
      console.log('otp', otpCode);
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
          available_balance_stripe: 0,
          pending_balance_stripe: 0,
          withdrawn_total_stripe: 0,
        },
      });

      const emailDto: SendEmailDto = {
        to: user.email,
        subject: 'Welcome to Velro',
        text: 'Thank you for joining Velro! We are excited to have you on board.',
        html: `<h1> Your verification code is: <strong>${otpCode}</strong></h1>`,
      };

      await this.sendEmail(emailDto, 'en');

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
    const user = await this.prisma.user.findUnique({
      where: { email },
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
    // if (!user.emailVerify) {
    //   throw new BadRequestException('Email not verify');
    // }
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
  async upsertUserFromOAuth(oauth: {
    provider: 'GOOGLE' | 'APPLE';
    providerAccountId: string;
    email: string | null;
    name: string | null;
    picture: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    idToken?: string | null; // Apple
  }) {
    const provider = oauth.provider;

    // Si on a un email, on tente de relier à un user existant
    let user = oauth.email
      ? await this.prisma.user.findUnique({ where: { email: oauth.email } })
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
      const otpCode = randomInt(100_000, 1_000_000);
      const otpHash = await bcrypt.hash(String(otpCode), saltRounds);
      user = await this.prisma.user.create({
        data: {
          email: oauth.email,
          password: '',
          name: oauth.name,
          picture: oauth.picture,
          otpCode: otpHash,
        },
      });

      const emailDto: SendEmailDto = {
        to: user.email,
        subject: 'Welcome to Velro',
        text: 'Thank you for joining Velro! We are excited to have you on board.',
        html: `<h1> Your verification code is: <strong>${otpCode}</strong></h1>`,
      };

      await this.sendEmail(emailDto, 'en');

      // Create initial UserKYC record with NOT_STARTED status for OAuth users
      await this.prisma.userKYC.create({
        data: {
          userId: user.id,
          status: 'NOT_STARTED',
          provider: 'DIDIT',
        },
      });
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
    const user = await this.upsertUserFromOAuth({
      provider: 'GOOGLE',
      providerAccountId: sub,
      email,
      name,
      picture,
      idToken,
    });
    return this.issueTokens(user.user.id);
  }

  // APPLE: vérifier l’id_token via JWKS
  async loginWithAppleIdToken(idToken: string) {
    const client = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
    });
    const decodedHeader: any = jwt.decode(idToken, { complete: true });
    const kid = decodedHeader?.header?.kid;
    const key = await client.getSigningKey(kid);
    const signingKey = key.getPublicKey();

    const verified = jwt.verify(idToken, signingKey, {
      algorithms: ['RS256'],
      audience: process.env.APPLE_CLIENT_ID!, // très important !
      issuer: 'https://appleid.apple.com',
    }) as any;

    const sub = verified.sub;
    const email = verified.email ?? null;

    if (!sub) throw new BadRequestException('Invalid Apple id_token');

    const user = await this.upsertUserFromOAuth({
      provider: 'APPLE',
      providerAccountId: sub,
      email,
      name: null,
      picture: null,
      idToken,
    });

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
    } = pendingSignupDto;

    // Check if email already exists in User table
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const message = await this.i18n.translate(
        'translation.auth.signup.emailExists',
        {
          lang,
          defaultValue: 'Email already exists',
        },
      );
      throw new ConflictException(message);
    }

    // Validate freight forwarder requirements
    if (isFreightForwarder) {
      if (!companyName || !companyAddress) {
        const message = await this.i18n.translate(
          'translation.auth.signup.companyRequired',
          {
            lang,
            defaultValue:
              'Company name and address are required for freight forwarders',
          },
        );
        throw new BadRequestException(message);
      }

      if (!cities || cities.length === 0) {
        const message = await this.i18n.translate(
          'translation.auth.signup.citiesRequired',
          {
            lang,
            defaultValue:
              'At least one city is required for freight forwarders',
          },
        );
        throw new BadRequestException(message);
      }

      if (!services || services.length === 0) {
        const message = await this.i18n.translate(
          'translation.auth.signup.servicesRequired',
          {
            lang,
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
        email,
        'SIGNUP',
        phone,
        lang,
      );

      // Create pending user
      const pendingUser = await this.prisma.pendingUser.create({
        data: {
          firstName,
          lastName,
          email,
          username,
          phone,
          city,
          companyName,
          companyAddress,
          additionalInfo: '',
          isFreightForwarder,
          otp_id: otpResult.email, // We'll store the OTP ID here
          expiresAt: otpResult.expiresAt,
        },
      });

      // Create company cities if freight forwarder
      if (isFreightForwarder && cities.length > 0) {
        for (const cityData of cities) {
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
      if (isFreightForwarder && services.length > 0) {
        for (const serviceData of services) {
          await this.prisma.companyService.create({
            data: {
              name: serviceData.name,
              description: serviceData.description,
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
          lang,
          defaultValue:
            'Pending user created successfully. Please check your email for OTP.',
        },
      );

      return {
        message,
        pendingUserId: pendingUser.id,
        email,
        expiresAt: otpResult.expiresAt,
      };
    } catch (error: any) {
      console.error('Error creating pending user:', error);
      const message = await this.i18n.translate(
        'translation.auth.pendingSignup.failed',
        {
          lang,
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
          currency: 'XAF',
          available_balance_stripe: 0,
          pending_balance_stripe: 0,
          withdrawn_total_stripe: 0,
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
}
