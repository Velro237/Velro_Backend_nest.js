import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  Patch,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { PaymentService } from '../payment/payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  WithdrawalRequestDto,
  WithdrawalResponseDto,
  WalletResponseDto,
  ChangeWalletStateDto,
  ChangeWalletStateResponseDto,
} from './dto/wallet.dto';
import {
  ConnectOnboardingDto,
  ConnectOnboardingResponseDto,
  ConnectStatusResponseDto,
} from '../payment/dto/connect-onboarding.dto';

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
  @ApiResponse({
    status: 400,
    description: 'Invalid request or insufficient balance',
  })
  async requestWithdrawal(
    @Body() dto: WithdrawalRequestDto,
    @Request() req: any,
  ): Promise<WithdrawalResponseDto> {
    return this.walletService.requestWithdrawal(req.user.id, dto);
  }

  @Patch('admin/change-state/:userId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({
    summary: 'Change wallet state (Admin only)',
    description:
      "Allows admins to change a user's wallet state between ACTIVE and BLOCKED. Optionally provide a status_message explaining the change.",
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID whose wallet state to change',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: ChangeWalletStateDto,
    description: 'Wallet state change data',
    examples: {
      activate: {
        summary: 'Activate wallet',
        value: {
          state: 'ACTIVE',
          status_message: 'Wallet activated after verification',
        },
      },
      block: {
        summary: 'Block wallet',
        value: {
          state: 'BLOCKED',
          status_message: 'Wallet blocked due to suspicious activity',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet state changed successfully',
    type: ChangeWalletStateResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async changeWalletState(
    @Param('userId') userId: string,
    @Body() dto: ChangeWalletStateDto,
  ): Promise<ChangeWalletStateResponseDto> {
    return this.walletService.changeWalletState(userId, dto);
  }
}

@ApiTags('Connect')
@Controller('connect')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ConnectController {
  constructor(private readonly paymentService: PaymentService) {}

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
    description:
      'Returns the status of Stripe Connect onboarding and capabilities',
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
