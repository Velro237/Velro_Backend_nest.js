import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { InitializeWalletRequestDto } from './dto/initialize-wallet-request.dto';
import { InitializeWalletResponseDto } from './dto/initialize-wallet.dto';
import {
  GetWalletRequestDto,
  GetWalletResponseDto,
} from './dto/get-wallet-request.dto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async initializeWallet(
    userId: string,
    initializeWalletDto: InitializeWalletRequestDto,
    lang: string = 'en',
  ): Promise<InitializeWalletResponseDto> {
    try {
      const { currency } = initializeWalletDto;

      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        const message = await this.i18n.translate(
          'translation.payment.wallet.userNotFound',
          {
            lang,
            defaultValue: 'User not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Check if wallet already exists for this user
      const existingWallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (existingWallet) {
        const message = await this.i18n.translate(
          'translation.payment.wallet.alreadyExists',
          {
            lang,
            defaultValue: 'User already has a wallet',
          },
        );
        throw new ConflictException(message);
      }

      // Create wallet with provided or default currency
      const wallet = await this.prisma.wallet.create({
        data: {
          userId,
          available_balance: 0.0,
          hold_balance: 0.0,
          total_balance: 0.0,
          state: 'BLOCKED',
          currency,
        },
      });

      const message = await this.i18n.translate(
        'translation.payment.wallet.initialized',
        {
          lang,
          defaultValue: 'Wallet initialized successfully',
        },
      );

      return {
        message,
        wallet: {
          id: wallet.id,
          userId: wallet.userId,
          available_balance: Number(wallet.available_balance),
          hold_balance: Number(wallet.hold_balance),
          total_balance: Number(wallet.total_balance),
          state: wallet.state,
          currency: wallet.currency,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.payment.wallet.initializeFailed',
        {
          lang,
          defaultValue: 'Failed to initialize wallet',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getWallet(
    getWalletDto: GetWalletRequestDto,
    lang: string = 'en',
  ): Promise<GetWalletResponseDto> {
    try {
      const { walletId, userId } = getWalletDto;

      // Validate that either walletId or userId is provided, but not both
      if (!walletId && !userId) {
        throw new BadRequestException(
          'Either walletId or userId must be provided',
        );
      }

      if (walletId && userId) {
        throw new BadRequestException(
          'Provide either walletId or userId, not both',
        );
      }

      // Build where clause based on provided parameter
      const whereClause: any = walletId ? { id: walletId } : { userId };

      const wallet = await this.prisma.wallet.findUnique({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              picture: true,
              role: true,
            },
          },
        },
      });

      if (!wallet) {
        const message = await this.i18n.translate(
          'translation.payment.wallet.notFound',
          {
            lang,
            defaultValue: 'Wallet not found',
          },
        );
        throw new NotFoundException(message);
      }

      const message = await this.i18n.translate(
        'translation.payment.wallet.retrieved',
        {
          lang,
          defaultValue: 'Wallet retrieved successfully',
        },
      );

      return {
        message,
        wallet: {
          id: wallet.id,
          userId: wallet.userId,
          available_balance: Number(wallet.available_balance),
          hold_balance: Number(wallet.hold_balance),
          total_balance: Number(wallet.total_balance),
          state: wallet.state,
          currency: wallet.currency,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
          user: wallet.user,
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.payment.wallet.getFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve wallet',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }
}
