import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto, SignupResponseDto } from './dto/signup.dto';
import { LoginDto, LoginResponseDto, TokenLoginDto } from './dto/login.dto';
import { I18nLang } from 'nestjs-i18n';
import {
  ApiSignup,
  ApiLogin,
  ApiGoogleOAuth,
  ApiGoogleOAuthCallback,
  ApiAppleOAuth,
  ApiAppleOAuthCallback,
  ApiGoogleTokenLogin,
  ApiAppleTokenLogin,
} from './decorators/api-docs.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthGuard } from '@nestjs/passport';

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
    console.log(signupDto);
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

  @ApiGoogleOAuth()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  // redirige vers Google
  async googleAuth() {
    console.log('laaa');
  }

  @ApiGoogleOAuthCallback()
  @Get('google/callback')
  @ApiSignup()
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req, @Res() res) {
    const user = await this.authService.upsertUserFromOAuth(req.user);
    const tokens = await this.authService.issueTokens(user.user.id);
    // redirige vers ton front avec les tokens (ou set cookies)
    const url = `${process.env.APP_URL}/oauth/callback?access=${tokens.accessToken}&refresh=${tokens.refreshToken}`;
    return res.redirect(url);
  }

  // ======== APPLE (web redirect) ========
  @ApiAppleOAuth()
  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleAuth() {}

  @ApiAppleOAuthCallback()
  @Get('apple/callback')
  @UseGuards(AuthGuard('apple'))
  async appleCallback(@Req() req, @Res() res) {
    const user = await this.authService.upsertUserFromOAuth(req.user);
    const tokens = await this.authService.issueTokens(user.user.id);
    const url = `${process.env.APP_URL}/oauth/callback?access=${tokens.accessToken}&refresh=${tokens.refreshToken}`;
    return res.redirect(url);
  }

  // ======== Flux mobile (id_token) ========

  @ApiGoogleTokenLogin()
  @Post('google/token')
  async googleTokenLogin(@Body() body: TokenLoginDto) {
    return this.authService.loginWithGoogleIdToken(body.idToken);
  }

  @ApiAppleTokenLogin()
  @Post('apple/token')
  async appleTokenLogin(@Body() body: TokenLoginDto) {
    return this.authService.loginWithAppleIdToken(body.idToken);
  }
}
