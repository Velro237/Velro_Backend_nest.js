import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateMarketplaceOfferDto } from './dto/create-marketplace-offer.dto';
import { MarketplaceListingService } from 'src/marketplace-listing/marketplace-listing.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MarketplaceListingItemStatus, MessageType } from 'generated/prisma';
import { ListingErrorMessage } from 'src/marketplace-listing/misc/listing-error-message';
import { ListingOfferErrorMessage } from './misc/listing-offer-error-message';
import { ChatGateway } from 'src/chat/chat.gateway';
import { ChatService } from 'src/chat/chat.service';
import { TimeMs } from 'src/shared/utils';
import { PaginationQueryDto } from 'src/wallet/dto/wallet.dto';

@Injectable()
export class MarketplaceOfferService {
  private readonly logger = new Logger(MarketplaceOfferService.name);

  constructor(
    private readonly listingService: MarketplaceListingService,
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async create(
    listingId: string,
    userId: string,
    { price, message, deliveryOption, currency }: CreateMarketplaceOfferDto,
  ) {
    // Steps
    // 1. Check if the listing is available
    const listing = await this.listingService.findOne(listingId);

    // 2. Sanity check
    if (listing.currency !== currency) {
      throw new BadRequestException(
        ListingOfferErrorMessage.OFFER_CURRENCY_MISMATCH,
      );
    }

    if (listing.status !== MarketplaceListingItemStatus.PUBLISHED) {
      throw new NotFoundException(ListingErrorMessage.LISTING_NOT_FOUND);
    }

    if (listing.userId === userId) {
      throw new ForbiddenException(ListingOfferErrorMessage.OFFER_NOT_ALLOWED);
    }

    const now = new Date();
    const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const expiresAt = new Date(today + TimeMs.days(7));

    // 3. Create an offer
    const offer = await this.prisma.listingOffer.create({
      data: {
        buyer: {
          connect: {
            id: userId,
          },
        },
        listing: {
          connect: {
            id: listingId,
          },
        },
        offerAmount: price,
        message,
        deliveryOption,
        expiresAt,
      },
    });

    return offer;
  }

  findAll() {
    return `This action returns all marketplaceOffer`;
  }

  findOne(id: number) {
    return `This action returns a #${id} marketplaceOffer`;
  }

  async findAllOffersByListingId(
    userId: string,
    listingId: string,
    { page = 1, limit = 10 }: PaginationQueryDto,
  ) {
    const skip = (page - 1) * limit;

    const [content, totalItems] = await Promise.all([
      this.prisma.listingOffer.findMany({
        where: {
          listing: { userId, id: listingId },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit + 1,
        skip,
      }),
      this.prisma.listingOffer.count({
        where: {
          listing: { userId, id: listingId },
        },
      }),
    ]);

    const hasNextPage = content.length > limit;
    const nextPage = hasNextPage ? page + 1 : null;
    const previousPage = page > 1 ? page - 1 : null;
    const totalPages = Math.ceil(totalItems / limit);

    return {
      content,
      page: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage,
        previousPage,
        nextPage,
      },
    };
  }

  async acceptOffer(userId: string, offerId: string) {
    const offer = await this.prisma.listingOffer.findUnique({
      where: { id: offerId },
      include: { listing: true },
    });

    if (!offer || offer.listing.userId !== userId) {
      throw new NotFoundException(ListingOfferErrorMessage.OFFER_NOT_FOUND);
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException(ListingOfferErrorMessage.OFFER_UNAVAILABLE);
    }

    if (offer.listing.status !== 'PUBLISHED') {
      throw new BadRequestException(
        ListingErrorMessage.LISTING_CANNOT_BE_MODIFIED,
      );
    }

    // Set this offer to ACCEPTED and mark shipping request as OFFER_ACCEPTED
    const updatedOffer = await this.prisma.$transaction(async (tx) => {
      // Get other pending offers to send rejection messages
      const otherOffers = await tx.listingOffer.findMany({
        where: {
          listingId: offer.listingId,
          status: 'PENDING',
          NOT: { id: offerId },
        },
        select: {
          id: true,
          chatId: true,
          buyerId: true,
          offerAmount: true,
          currency: true,
          deliveryOption: true,
        },
      });

      // Reject other pending offers for this request
      await tx.listingOffer.updateMany({
        where: {
          listingId: offer.listingId,
          status: 'PENDING',
          NOT: { id: offerId },
        },
        data: { status: 'REJECTED', rejectedAt: new Date() },
      });

      const o = await tx.listingOffer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      await tx.marketplaceListing.update({
        where: { id: offer.listingId },
        data: { status: 'PAID_ESCROW' },
      });

      // TODO: Pay escrow

      // Send rejection messages to other offers
      for (const otherOffer of otherOffers) {
        if (otherOffer.chatId) {
          try {
            const rejectionMessage = {
              status: 'REJECTED',
              offerId: otherOffer.id,
              rejectedAt: new Date().toISOString(),
              reason: 'Another offer was accepted',
            };

            await tx.message.create({
              data: {
                content: `Offer Declined - Unfortunately, the requester declined your offer of ${otherOffer.currency} ${Number(otherOffer.offerAmount).toFixed(2)}.`,
                type: 'SYSTEM',
                chat_id: otherOffer.chatId,
                sender_id: userId,
                data: rejectionMessage,
              },
            });

            this.logger.log(
              `Sent auto-rejection message to chat ${otherOffer.chatId} for shipping offer ${otherOffer.id}`,
            );
          } catch (err) {
            this.logger.warn(
              `Failed to send rejection message to chat ${otherOffer.chatId}: ${(err as Error)?.message || err}`,
            );
          }
        }
      }

      return o;
    });

    // Send automatic acceptance message to chat if chat exists
    if (offer.chatId) {
      try {
        const reward = Number(offer.offerAmount);

        const acceptanceMessage = {
          status: 'ACCEPTED',
          totalAmount: reward,
          currency: offer.currency,
          reward,
          offerId: offer.id,
          acceptedAt: new Date().toISOString(),
        };

        // Get requester info
        const requester = await this.prisma.user.findUnique({
          where: { id: offer.listing.userId },
          select: { username: true, email: true },
        });

        await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chatId,
          senderId: userId,
          content: `Offer Accepted - ${requester?.username || requester?.email || 'Requester'} accepted your shipping offer of ${offer.currency} ${reward.toFixed(2)}. Waiting for payment.`,
          type: MessageType.SYSTEM,
          messageData: acceptanceMessage,
        });

        this.logger.log(
          `Sent acceptance message to chat ${offer.chatId} for shipping offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send acceptance message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return updatedOffer;
  }

  async declineOffer(userId: string, offerId: string) {
    const offer = await this.prisma.listingOffer.findUnique({
      where: { id: offerId },
      include: { listing: true },
    });

    if (!offer || offer.listing.userId !== userId) {
      throw new NotFoundException(ListingOfferErrorMessage.OFFER_NOT_FOUND);
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException(
        ListingOfferErrorMessage.OFFER_CANNOT_BE_MODIFIED,
      );
    }

    const updated = await this.prisma.listingOffer.update({
      where: { id: offerId },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    });

    // Send automatic rejection message to chat if chat exists
    if (offer.chatId) {
      try {
        const reward = Number(offer.offerAmount);

        const rejectionMessage = {
          status: 'REJECTED',
          offerId: offer.id,
          rejectedAt: new Date().toISOString(),
        };

        await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chatId,
          senderId: userId,
          content: `Offer Declined - Unfortunately, the requester declined your offer of ${offer.currency} ${reward.toFixed(2)}.`,
          type: MessageType.SYSTEM,
          messageData: rejectionMessage,
        });

        this.logger.log(
          `Sent rejection message to chat ${offer.chatId} for shipping offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send rejection message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return updated;
  }

  remove(id: number) {
    return `This action removes a #${id} marketplaceOffer`;
  }
}
