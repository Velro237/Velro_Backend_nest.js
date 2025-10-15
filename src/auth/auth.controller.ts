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
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto, SignupResponseDto, VerifyEmailDto } from './dto/signup.dto';
import { LoginDto, LoginResponseDto, TokenLoginDto } from './dto/login.dto';
import {
  SendOtpDto,
  VerifyOtpDto,
  SendOtpResponseDto,
  VerifyOtpResponseDto,
  VerifyAccessKeyDto,
  VerifyAccessKeyResponseDto,
} from './dto/otp.dto';
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
  VerifyEmail,
} from './decorators/api-docs.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { OtpService } from './otp/otp.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiSignup()
  async signup(
    @Body() signupDto: SignupDto,
    @I18nLang() lang: string,
  ): Promise<SignupResponseDto> {
    return this.authService.signup(signupDto, lang);
  }

  @Patch('verify-otp/:id')
  @HttpCode(HttpStatus.OK)
  @VerifyEmail()
  async verify(
    @Body() emailDto: VerifyEmailDto,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const data: VerifyEmailDto = { userId: id, code: emailDto.code };
    return this.authService.verifyEmail(data, 'en');
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

  // ======== OTP Endpoints ========

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP code to email' })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    type: SendOtpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid email or failed to send',
  })
  async sendOtp(
    @Body() sendOtpDto: SendOtpDto,
    @I18nLang() lang: string,
  ): Promise<SendOtpResponseDto> {
    return this.otpService.createAndSendOtp(
      sendOtpDto.email,
      sendOtpDto.type,
      sendOtpDto.phone,
      lang,
    );
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code' })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    type: VerifyOtpResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired OTP',
  })
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @I18nLang() lang: string,
  ): Promise<VerifyOtpResponseDto> {
    const verifiedOtp = await this.otpService.verifyOtp(
      verifyOtpDto.email,
      verifyOtpDto.code,
      verifyOtpDto.type,
      lang,
    );

    return {
      message: 'OTP verified successfully',
      verified: verifiedOtp.verified,
      accessKey: verifiedOtp.access_key,
      email: verifiedOtp.email,
      type: verifiedOtp.type,
    };
  }

  @Post('otp/verify-access-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify access key' })
  @ApiResponse({
    status: 200,
    description: 'Access key is valid',
    type: VerifyAccessKeyResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired access key',
  })
  async verifyAccessKey(
    @Body() verifyAccessKeyDto: VerifyAccessKeyDto,
    @I18nLang() lang: string,
  ): Promise<VerifyAccessKeyResponseDto> {
    const otp = await this.otpService.verifyAccessKey(
      verifyAccessKeyDto.accessKey,
      verifyAccessKeyDto.email,
      verifyAccessKeyDto.type,
      lang,
    );

    return {
      message: 'Access key is valid',
      valid: true,
      email: otp.email,
      type: otp.type,
    };
  }
}
