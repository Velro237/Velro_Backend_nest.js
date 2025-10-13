import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { I18nLang } from 'nestjs-i18n';
import { User } from 'generated/prisma';
import {
  CreatePaymentIntentDto,
  PaymentIntentResponseDto,
} from './dto/create-payment-intent.dto';
import {
  ConnectOnboardingDto,
  ConnectOnboardingResponseDto,
  ConnectStatusResponseDto,
} from './dto/connect-onboarding.dto';
import { InitializeWalletRequestDto } from './dto/initialize-wallet-request.dto';
import { InitializeWalletResponseDto } from './dto/initialize-wallet.dto';
import {
  GetWalletRequestDto,
  GetWalletResponseDto,
} from './dto/get-wallet-request.dto';
import { CalculatePaymentDto, PaymentBreakdownDto } from './dto/calculate-payment.dto';
import {
  MobilemoneyCashoutDto,
  MobilemoneyCashoutResponseDto,
} from './dto/mobilemoney-cashout.dto';
import {
  MobilemoneyDepositDto,
  MobilemoneyDepositResponseDto,
} from './dto/mobilemoney-deposit.dto';
import { MoalaBalanceResponseDto } from './dto/moala-balance.dto';
import {
  ApiInitializeWallet,
  ApiGetWallet,
  ApiMobileMoneyCashout,
  ApiMobilemoneyDeposit,
  ApiGetMoalaBalance,
} from './decorators/api-docs.decorator';
import { MobilemoneyService } from './mobilemoney/mobilemoney.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@ApiExtraModels(
  InitializeWalletRequestDto,
  InitializeWalletResponseDto,
  GetWalletRequestDto,
  GetWalletResponseDto,
  MobilemoneyCashoutDto,
  MobilemoneyCashoutResponseDto,
  MobilemoneyDepositDto,
  MobilemoneyDepositResponseDto,
  MoalaBalanceResponseDto,
)
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
    private readonly mobilemoneyService: MobilemoneyService,
  ) {}

  @Post('wallet/initialize')
  @HttpCode(HttpStatus.CREATED)
  @ApiInitializeWallet()
  async initializeWallet(
    @Body() initializeWalletDto: InitializeWalletRequestDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<InitializeWalletResponseDto> {
    return this.paymentService.initializeWallet(
      user.id,
      initializeWalletDto,
      lang,
    );
  }

  @Post('wallet/get')
  @HttpCode(HttpStatus.OK)
  @ApiGetWallet()
  async getWallet(
    @Body() getWalletDto: GetWalletRequestDto,
    @I18nLang() lang: string,
  ): Promise<GetWalletResponseDto> {
    return this.paymentService.getWallet(getWalletDto, lang);
  }

  // ============================================
  // Mobile Money Endpoints
  // ============================================

  @Post('mobilemoney/cashout/init')
  @HttpCode(HttpStatus.OK)
  @ApiMobileMoneyCashout()
  async initiateMobileMoneyCashout(
    @Body() cashoutDto: MobilemoneyCashoutDto,
    @I18nLang() lang: string,
  ): Promise<MobilemoneyCashoutResponseDto> {
    return this.mobilemoneyService.makeWithdrawal(
      cashoutDto.amount,
      cashoutDto.phoneNumber,
      lang,
    );
  }

  @Post('mobilemoney/deposit/init')
  @HttpCode(HttpStatus.OK)
  @ApiMobilemoneyDeposit()
  async initiateMobilemoneyDeposit(
    @Body() depositDto: MobilemoneyDepositDto,
    @I18nLang() lang: string,
  ): Promise<MobilemoneyDepositResponseDto> {
    return this.mobilemoneyService.makeDeposit(
      depositDto.amount,
      depositDto.phoneNumber,
      lang,
    );
  }

  @Get('mobilemoney/balance')
  @UseGuards(AdminGuard)
  @ApiGetMoalaBalance()
  async getMoalaBalance(
    @I18nLang() lang: string,
  ): Promise<MoalaBalanceResponseDto> {
    return this.mobilemoneyService.balance(lang);
  }

  // ============================================
  // Stripe Payment Endpoints
  // ============================================

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate payment breakdown',
    description: 'Calculate how much sender will pay based on traveler price. Shows platform fee breakdown.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment breakdown calculated successfully',
    type: PaymentBreakdownDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid traveler price' })
  async calculatePayment(
    @Body() dto: CalculatePaymentDto,
  ): Promise<PaymentBreakdownDto> {
    return this.paymentService.calculatePaymentBreakdown(dto.travelerPrice);
  }

  @Post('init')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create PaymentIntent for sender payment',
    description:
      'Initiates a payment for an order. Returns client secret for Stripe.js',
  })
  @ApiResponse({
    status: 201,
    description: 'PaymentIntent created successfully',
    type: PaymentIntentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async initPayment(
    @Body() dto: CreatePaymentIntentDto,
    @Request() req: any,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentService.createPaymentIntent(dto, req.user.id);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook endpoint',
    description:
      'Handles Stripe webhook events (payment success, failures, etc.)',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    try {
      const rawBody = req.rawBody;
      if (!rawBody) {
        throw new BadRequestException('No raw body');
      }

      const event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret,
      );

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.paymentService.handlePaymentSuccess(event.data.object.id);
          break;

        case 'payment_intent.payment_failed':
          console.log('Payment failed:', event.data.object.id);
          // TODO: Update order payment status to FAILED
          break;

        case 'account.updated':
          console.log('Account updated:', event.data.object.id);
          // TODO: Update user's transfer capability status
          break;

        case 'transfer.created':
          console.log('Transfer created:', event.data.object.id);
          break;

        case 'transfer.updated':
          const transfer = event.data.object;
          if (transfer.reversed) {
            await this.walletService.handleTransferFailed(
              transfer.id,
              'Transfer was reversed',
            );
          } else {
            await this.walletService.handleTransferCompleted(transfer.id);
          }
          break;

        case 'charge.refunded':
          console.log('Charge refunded:', event.data.object.id);
          // TODO: Handle refund logic
          break;

        case 'charge.dispute.created':
          console.log('Dispute created:', event.data.object.id);
          // TODO: Freeze wallet or reverse transfer
          break;

        default:
          console.log('Unhandled event type:', event.type);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error:', error);
      throw error;
    }
  }
}
