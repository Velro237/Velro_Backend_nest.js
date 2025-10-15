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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
          emailVerify: true,
          otpCode: true,
        },
      });
      if (!user) this.fail();
      if (user.emailVerify) {
        return { success: true, message: 'Email déjà vérifié' };
      }
      const codeVerify = await bcrypt.compare(code, user.otpCode);
      if (!codeVerify) this.fail();
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerify: true,
          otpCode: '0',
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
}
