import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, SignupResponseDto } from './dto/signup.dto';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { I18nService, I18nContext } from 'nestjs-i18n';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(
    signupDto: SignupDto,
    lang?: string,
  ): Promise<SignupResponseDto> {
    const { email, password, role = 'USER' } = signupDto;

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

      // Create the user
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
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
        user,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.auth.signup.createFailed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
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
      },
    };
  }
}
