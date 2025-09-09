import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto, SignupResponseDto } from './dto/signup.dto';
import { I18nLang } from 'nestjs-i18n';
import { ApiSignup } from './decorators/api-docs.decorator';

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
}
