import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiBody,
  ApiParam,
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
import {
  CalculatePaymentDto,
  PaymentBreakdownDto,
} from './dto/calculate-payment.dto';
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
import {
  CreateWithdrawalNumberDto,
  UpdateWithdrawalNumberDto,
  WithdrawalNumberDto,
  WithdrawalNumberListDto,
  DeleteWithdrawalNumberResponseDto,
} from './dto/withdrawal-number.dto';
import {
  MobilemoneyKycDto,
  MobilemoneyKycResponseDto,
} from './dto/mobilemoney-kyc.dto';

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
  MobilemoneyKycDto,
  MobilemoneyKycResponseDto,
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

  @Post('mobilemoney/pay')
  @HttpCode(HttpStatus.OK)
  @ApiMobileMoneyCashout()
  async initiateMobileMoneyCashout(
    @CurrentUser() user: User,
    @Body() cashoutDto: MobilemoneyCashoutDto,
    @I18nLang() lang: string,
  ): Promise<MobilemoneyCashoutResponseDto> {
    return this.mobilemoneyService.makeWithdrawal(
      user.id,
      cashoutDto.requestId,
      cashoutDto.withdrawalNumberId,
      lang,
    );
  }

  @Post('mobilemoney/deposit')
  @HttpCode(HttpStatus.OK)
  @ApiMobilemoneyDeposit()
  async initiateMobilemoneyDeposit(
    @CurrentUser() user: User,
    @Body() depositDto: MobilemoneyDepositDto,
    @I18nLang() lang: string,
  ): Promise<MobilemoneyDepositResponseDto> {
    return this.mobilemoneyService.makeDeposit(
      depositDto.amount,
      depositDto.withdrawalNumberId,
      user.id,
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

  @Post('mobilemoney/kyc')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perform KYC check on a mobile money number',
    description:
      'Check the KYC status of a mobile money phone number for Cameroon (MTN or Orange). The service code is automatically determined from the phone number prefix.',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC check completed successfully',
    type: MobilemoneyKycResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid phone number',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - Failed to perform KYC check',
  })
  @ApiBody({
    description: 'KYC check details - only phone number is required',
    type: MobilemoneyKycDto,
  })
  async performKyc(
    @Body() kycDto: MobilemoneyKycDto,
    @I18nLang() lang: string,
  ): Promise<MobilemoneyKycResponseDto> {
    // Determine carrier from phone number prefix
    const carrier = this.mobilemoneyService.getWithdrawalCarrier(
      kycDto.phoneNumber,
    );

    if (!carrier) {
      throw new BadRequestException(
        'Invalid phone number - cannot determine carrier. Please provide a valid MTN or Orange Cameroon number.',
      );
    }

    // Map carrier to service code
    const serviceCode =
      carrier === 'MTN'
        ? 'PAIEMENTMARCHAND_MTN_CM'
        : 'PAIEMENTMARCHAND_ORANGE_CM';

    const result = await this.mobilemoneyService.kyc(
      kycDto.phoneNumber,
      serviceCode,
      lang,
    );
    return {
      data: result,
      message: 'KYC check completed successfully',
    };
  }

  // ============================================
  // Stripe Payment Endpoints
  // ============================================

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate payment breakdown',
    description:
      'Calculate how much sender will pay based on traveler price. Shows platform fee breakdown.',
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

        case 'payment_intent.canceled':
          console.log('PaymentIntent canceled:', event.data.object.id);
          await this.paymentService.handlePaymentCancellation(
            event.data.object.id,
          );
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
          await this.paymentService.handleRefund(event.data.object);
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

  @Public()
  @Post('mobilemoney/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mobile money payment callback',
    description:
      'Handles mobile money payment status updates from payment providers',
  })
  @ApiResponse({
    status: 200,
    description: 'Callback processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid callback data',
  })
  @ApiBody({
    description: 'Mobile money payment callback data',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Payment status',
          example: 'RECEIVED',
        },
        amount: {
          type: 'string',
          description: 'Payment amount',
          example: '135000.0',
        },
        partnerId: {
          type: 'string',
          description: 'Partner/Provider transaction ID',
          example: 'TR1B2C7001C1669',
        },
        operatorId: {
          type: 'string',
          description: 'Operator transaction ID',
          example: '12882787757',
        },
        serviceCode: {
          type: 'string',
          description: 'Service code',
          example: 'PAIEMENTMARCHAND_MTN_CM',
        },
        message: {
          type: 'string',
          nullable: true,
          description: 'Optional message',
          example: null,
        },
      },
      required: ['status', 'amount', 'partnerId', 'operatorId', 'serviceCode'],
    },
    examples: {
      success: {
        summary: 'Successful payment callback',
        description: 'Example of a successful payment callback',
        value: {
          status: 'RECEIVED',
          amount: '135000.0',
          partnerId: 'TR1B2C7001C1669',
          operatorId: '12882787757',
          serviceCode: 'PAIEMENTMARCHAND_MTN_CM',
          message: null,
        },
      },
      pending: {
        summary: 'Pending payment callback',
        description: 'Example of a pending payment callback',
        value: {
          status: 'PENDING',
          amount: '50000.0',
          partnerId: 'TR1B2C7001C1668',
          operatorId: '12882787758',
          serviceCode: 'PAIEMENTMARCHAND_ORANGE_CM',
          message: 'Payment is being processed',
        },
      },
      failed: {
        summary: 'Failed payment callback',
        description: 'Example of a failed payment callback',
        value: {
          status: 'FAILED',
          amount: '25000.0',
          partnerId: 'TR1B2C7001C1667',
          operatorId: '12882787759',
          serviceCode: 'PAIEMENTMARCHAND_MTN_CM',
          message: 'Insufficient funds',
        },
      },
    },
  })
  async handleMobileMoneyCallback(
    @Body()
    callbackData: {
      status: string;
      amount: string;
      partnerId: string;
      operatorId: string;
      serviceCode: string;
      message: string | null;
    },
  ): Promise<{ success: boolean; message: string }> {
    return this.mobilemoneyService.handlePaymentCallback(callbackData);
  }

  /**
   * Withdrawal Number Management Endpoints
   */

  @Post('withdrawal-number')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new withdrawal number',
    description: 'Create a new withdrawal number for the authenticated user',
  })
  @ApiBody({ type: CreateWithdrawalNumberDto })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal number created successfully',
    type: WithdrawalNumberDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Invalid input or mobile number already registered',
  })
  async createWithdrawalNumber(
    @Body() createDto: CreateWithdrawalNumberDto,
    @CurrentUser() user: User,
  ): Promise<WithdrawalNumberDto> {
    return this.mobilemoneyService.createWithdrawalNumber(
      user.id,
      createDto.number,
      createDto.name,
    );
  }

  @Get('withdrawal-numbers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user withdrawal numbers',
    description: 'Retrieve all withdrawal numbers for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal numbers retrieved successfully',
    type: WithdrawalNumberListDto,
  })
  async getUserWithdrawalNumbers(
    @CurrentUser() user: User,
  ): Promise<{ withdrawalNumbers: WithdrawalNumberDto[] }> {
    const withdrawalNumbers =
      await this.mobilemoneyService.getUserWithdrawalNumbers(user.id);
    return { withdrawalNumbers };
  }

  @Put('withdrawal-numbers/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a withdrawal number',
    description:
      'Update an existing withdrawal number for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    description: 'Withdrawal number ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateWithdrawalNumberDto })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal number updated successfully',
    type: WithdrawalNumberDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Invalid input or mobile number already registered',
  })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal number not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this withdrawal number',
  })
  async updateWithdrawalNumber(
    @Param('id') id: string,
    @Body() updateDto: UpdateWithdrawalNumberDto,
    @CurrentUser() user: User,
  ): Promise<WithdrawalNumberDto> {
    return this.mobilemoneyService.updateWithdrawalNumber(
      id,
      user.id,
      updateDto.number,
      updateDto.name,
    );
  }

  @Delete('withdrawal-numbers/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a withdrawal number',
    description: 'Delete a withdrawal number for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    description: 'Withdrawal number ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal number deleted successfully',
    type: DeleteWithdrawalNumberResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal number not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not own this withdrawal number',
  })
  async deleteWithdrawalNumber(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<DeleteWithdrawalNumberResponseDto> {
    return this.mobilemoneyService.deleteWithdrawalNumber(id, user.id);
  }
}
