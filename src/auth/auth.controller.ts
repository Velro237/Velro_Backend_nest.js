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

  // ======== New Pending Signup Flow ========

  @Post('pending-signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create pending user and send OTP',
    description:
      'Creates a pending user account and sends OTP for verification. Required fields: firstName, lastName, username, phone, email, city. For freight forwarders: companyName, companyAddress, at least one city and one service are required.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pending user created successfully',
    type: PendingSignupResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Missing required fields or validation errors',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Email already exists',
  })
  async createPendingUser(
    @Body() pendingSignupDto: PendingSignupDto,
    @I18nLang() lang: string,
  ): Promise<PendingSignupResponseDto> {
    return this.authService.createPendingUser(pendingSignupDto, lang);
  }

  @Post('check-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check OTP and get access key',
    description:
      'Verifies the OTP code for a pending user and returns an access key for completing signup.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    type: CheckOtpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid pending user ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired OTP',
  })
  async checkOtp(
    @Body() checkOtpDto: CheckOtpDto,
    @I18nLang() lang: string,
  ): Promise<CheckOtpResponseDto> {
    return this.authService.checkOtp(checkOtpDto, lang);
  }

  @Post('complete-signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Complete signup with access key and password',
    description:
      'Completes the signup process by creating the actual user account using the access key from OTP verification and a password.',
  })
  @ApiResponse({
    status: 201,
    description: 'User account created successfully',
    type: CompleteSignupResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid pending user ID or missing password',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid access key',
  })
  async completeSignup(
    @Body() completeSignupDto: CompleteSignupDto,
    @I18nLang() lang: string,
  ): Promise<CompleteSignupResponseDto> {
    return this.authService.completeSignup(completeSignupDto, lang);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP for pending user',
    description: "Sends a new OTP to the pending user's email address.",
  })
  @ApiResponse({
    status: 200,
    description: 'OTP resent successfully',
    type: ResendOtpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid pending user ID',
  })
  async resendOtp(
    @Body() resendOtpDto: ResendOtpDto,
    @I18nLang() lang: string,
  ): Promise<ResendOtpResponseDto> {
    return this.authService.resendOtp(resendOtpDto, lang);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Sends a password reset OTP code to the user email address.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset OTP sent successfully',
    type: RequestPasswordResetResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - User not found',
  })
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
    @I18nLang() lang: string,
  ): Promise<RequestPasswordResetResponseDto> {
    return this.authService.requestPasswordReset(requestPasswordResetDto, lang);
  }

  @Post('check-password-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check password reset OTP',
    description:
      'Verifies the OTP code sent via email and returns an access key to be used for password reset.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    type: CheckPasswordResetOtpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired OTP',
  })
  async checkPasswordResetOtp(
    @Body() checkPasswordResetOtpDto: CheckPasswordResetOtpDto,
    @I18nLang() lang: string,
  ): Promise<CheckPasswordResetOtpResponseDto> {
    return this.authService.checkPasswordResetOtp(
      checkPasswordResetOtpDto,
      lang,
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Resets user password using access key and new password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid access key or expired',
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @I18nLang() lang: string,
  ): Promise<ResetPasswordResponseDto> {
    return this.authService.resetPassword(resetPasswordDto, lang);
  }
}
