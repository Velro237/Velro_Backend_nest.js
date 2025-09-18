import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto, SignupResponseDto } from './dto/signup.dto';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { I18nLang } from 'nestjs-i18n';
import { ApiSignup, ApiLogin } from './decorators/api-docs.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiSignup()
  async signup(
    @Body() signupDto: SignupDto,
    @I18nLang() lang: string,
  ): Promise<SignupResponseDto> {
    return this.authService.signup(signupDto, lang);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiLogin()
  async login(
    @Request() req: any,
    @Body() loginDto: LoginDto,
    @I18nLang() lang: string,
  ): Promise<LoginResponseDto> {
    return this.authService.login(loginDto, lang);
  }
}
