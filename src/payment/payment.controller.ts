import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiExtraModels, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { I18nLang } from 'nestjs-i18n';
import { User } from 'generated/prisma';
import { InitializeWalletRequestDto } from './dto/initialize-wallet-request.dto';
import { InitializeWalletResponseDto } from './dto/initialize-wallet.dto';
import {
  GetWalletRequestDto,
  GetWalletResponseDto,
} from './dto/get-wallet-request.dto';
import {
  ApiInitializeWallet,
  ApiGetWallet,
} from './decorators/api-docs.decorator';

@ApiTags('Payment')
@ApiBearerAuth('JWT-auth')
@ApiExtraModels(
  InitializeWalletRequestDto,
  InitializeWalletResponseDto,
  GetWalletRequestDto,
  GetWalletResponseDto,
)
@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
}
