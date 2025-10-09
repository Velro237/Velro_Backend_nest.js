import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { PaymentService } from '../payment/payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { 
  WithdrawalRequestDto, 
  WithdrawalResponseDto, 
  WalletResponseDto,
} from './dto/wallet.dto';
import { ConnectOnboardingDto, ConnectOnboardingResponseDto, ConnectStatusResponseDto } from '../payment/dto/connect-onboarding.dto';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get wallet information',
    description: 'Returns wallet balances and recent transactions',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet information retrieved successfully',
    type: WalletResponseDto,
  })
  async getWallet(@Request() req: any): Promise<WalletResponseDto> {
    return this.walletService.getWallet(req.user.id);
  }

  @Post('withdrawals/request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Request withdrawal',
    description: 'Request to withdraw available balance to your bank account',
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created successfully',
    type: WithdrawalResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request or insufficient balance' })
  async requestWithdrawal(
    @Body() dto: WithdrawalRequestDto,
    @Request() req: any,
  ): Promise<WithdrawalResponseDto> {
    return this.walletService.requestWithdrawal(req.user.id, dto);
  }
}

@ApiTags('Connect')
@Controller('connect')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ConnectController {
  constructor(
    private readonly paymentService: PaymentService,
  ) {}

  @Post('onboard')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start Stripe Connect onboarding',
    description: 'Creates a Stripe Express account and returns onboarding URL',
  })
  @ApiResponse({
    status: 201,
    description: 'Onboarding URL created successfully',
    type: ConnectOnboardingResponseDto,
  })
  async onboard(
    @Body() dto: ConnectOnboardingDto,
    @Request() req: any,
  ): Promise<ConnectOnboardingResponseDto> {
    return this.paymentService.onboardTraveler(req.user.id, dto);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get Connect account status',
    description: 'Returns the status of Stripe Connect onboarding and capabilities',
  })
  @ApiResponse({
    status: 200,
    description: 'Connect status retrieved successfully',
    type: ConnectStatusResponseDto,
  })
  async getStatus(@Request() req: any): Promise<ConnectStatusResponseDto> {
    return this.paymentService.getConnectStatus(req.user.id);
  }
}

