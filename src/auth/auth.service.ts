import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, SignupResponseDto } from './dto/signup.dto';
import { I18nService, I18nContext } from 'nestjs-i18n';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
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
      // const saltRounds = 10;
      // const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create the user
      const user = await this.prisma.user.create({
        data: {
          email,
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
}
