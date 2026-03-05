import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateShippingOfferDto } from './dto/create-shipping-offer.dto';
import { Decimal } from 'generated/prisma/runtime/library';
import {
  ShippingRequestStatus,
  MessageType as PrismaMessageType,
} from 'generated/prisma';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { WithdrawOfferDto } from './dto/withdraw-offer.dto';

@Injectable()
export class ShippingOfferService {
  private readonly logger = new Logger(ShippingOfferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async create(userId: string, dto: CreateShippingOfferDto, lang: string) {
    // Load shipping request
    const request = await this.prisma.shippingRequest.findUnique({
      where: { id: dto.requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'SHIPPING_REQUEST_NOT_FOUND',
        message: await this.i18n.translate(
          'translation.errors.shipping_request.not_found',
          { lang },
        ),
      });
    }

    if (request.user_id === userId) {
      throw new ForbiddenException({
        code: 'CANNOT_OFFER_OWN_REQUEST',
        message: await this.i18n.translate(
          'translation.errors.offers.cannot_offer_own_request',
          { lang },
        ),
      });
    }

    if (request.status !== ShippingRequestStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'REQUEST_NOT_PUBLISHED',
        message: await this.i18n.translate(
          'translation.errors.shipping_request.not_published',
          { lang },
        ),
      });
    }

    // Validate deliverBy if provided
    let deliverBy: Date | undefined;
    if (dto.deliverBy) {
      deliverBy = new Date(dto.deliverBy);
      if (isNaN(deliverBy.getTime())) {
        throw new BadRequestException({
          code: 'INVALID_DATE',
          message: 'deliverBy must be a valid ISO date',
        });
      }
    }

    let chatId: string | null = null;

    // STEP 1: Check if a chat already exists for this request between these two users (from pre-offer messaging)
    const existingRequestChat = await this.prisma.chat.findFirst({
      where: {
        shipping_request_id: dto.requestId,
        members: {
          every: {
            user_id: {
              in: [userId, request.user_id],
            },
          },
        },
      },
      select: { id: true },
    });

    if (existingRequestChat) {
      chatId = existingRequestChat.id;
      this.logger.log(
        `Reusing existing pre-offer chat ${chatId} for traveler ${userId} on shipping request ${dto.requestId}`,
      );

      // Optionally send the offer message to the existing chat if provided
      if (dto.message) {
        try {
          await this.chatGateway.sendMessageProgrammatically({
            chatId,
            senderId: userId,
            content: dto.message,
            type: PrismaMessageType.TEXT,
          });
        } catch (err) {
          this.logger.warn(
            `Failed to send message to existing chat: ${(err as Error)?.message || err}`,
          );
        }
      }
    } else {
      // STEP 2: Check if traveler already has an offer with a chat for this request
      const existingOffer = await this.prisma.shippingOffer.findFirst({
        where: {
          shipping_request_id: dto.requestId,
          traveler_id: userId,
        },
        include: { chat: true },
      });

      // If an existing offer with chat exists, reuse that chat
      if (existingOffer?.chat_id) {
        chatId = existingOffer.chat_id;
        this.logger.log(
          `Reusing existing offer chat ${chatId} for traveler ${userId} on shipping request ${dto.requestId}`,
        );
      } else {
        // STEP 3: Create a new private chat between traveler and request owner
        try {
          const chatResult = await this.chatService.createChat(
            {
              otherUserId: request.user_id,
              messageContent: dto.message || undefined,
            },
            userId,
            lang,
          );
          chatId = chatResult.chat.id;

          // Update chat type and link to shipping request
          await this.prisma.chat.update({
            where: { id: chatId },
            data: {
              type: 'SHIPPING',
              shipping_request_id: dto.requestId,
            },
          });

          this.logger.log(
            `Created new chat ${chatId} for shipping offer on request ${dto.requestId}`,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to create chat for shipping offer: ${(err as Error)?.message || err}`,
          );
          // Continue without chat - it's not critical
        }
      }
    }

    // Persist offer with linked chat
    const offer = await this.prisma.shippingOffer.create({
      data: {
        shipping_request_id: dto.requestId,
        traveler_id: userId,
        reward_amount: new Decimal(dto.rewardAmount),
        travel_date: deliverBy,
        message: dto.message || null,
        status: 'PENDING',
        chat_id: chatId,
      },
    });

    // Send automatic payment message to chat if chat exists
    if (chatId) {
      try {
        const reward = Number(dto.rewardAmount);

        const paymentMessage = {
          status: 'PENDING',
          totalAmount: reward,
          currency: 'EUR', // Default currency for shipping
          reward,
          offerId: offer.id,
          travelDate: deliverBy?.toISOString(),
        };

        await this.chatGateway.sendMessageProgrammatically({
          chatId,
          senderId: userId,
          content: `Shipping Offer Pending - Payment Requested: €${reward.toFixed(2)}`,
          type: PrismaMessageType.SHIPPING,
          messageData: paymentMessage,
        });

        this.logger.log(
          `Sent payment message to chat ${chatId} for shipping offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send payment message to chat: ${(err as Error)?.message || err}`,
        );
        // Don't fail offer creation if message fails
      }
    }

    return {
      id: offer.id,
      shippingRequestId: offer.shipping_request_id,
      travelerId: offer.traveler_id,
      rewardAmount: offer.reward_amount,
      message: offer.message,
      travelDate: offer.travel_date,
      status: offer.status,
      chatId: offer.chat_id,
      createdAt: offer.created_at,
    };
  }

  async getOffersForRequest(shippingRequestId: string, userId: string) {
    // Ensure request exists and belongs to user
    const request = await this.prisma.shippingRequest.findUnique({
      where: { id: shippingRequestId },
    });

    if (!request) {
      throw new NotFoundException({ code: 'SHIPPING_REQUEST_NOT_FOUND' });
    }

    if (request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    const offers = await this.prisma.shippingOffer.findMany({
      where: { shipping_request_id: shippingRequestId },
      include: {
        traveler: { select: { id: true, username: true, picture: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return offers.map((o) => ({
      id: o.id,
      shippingRequestId: o.shipping_request_id,
      travelerId: o.traveler_id,
      traveler: o.traveler,
      rewardAmount: o.reward_amount,
      message: o.message,
      travelDate: o.travel_date,
      status: o.status,
      chatId: o.chat_id,
      createdAt: o.created_at,
    }));
  }

  /**
   * Return chat information for a given shipping offer id if the caller is a member
   */
  async getChatForOffer(offerId: string, userId: string) {
    const offer = await this.prisma.shippingOffer.findUnique({
      where: { id: offerId },
      include: { shipping_request: { select: { user_id: true } } },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    const isMember =
      offer.traveler_id === userId ||
      offer.shipping_request?.user_id === userId;
    if (!isMember) {
      throw new ForbiddenException({ code: 'NOT_OFFER_MEMBER' });
    }

    if (!offer.chat_id) {
      throw new NotFoundException({ code: 'CHAT_NOT_FOUND' });
    }

    return this.chatService.getChatWithRequestAndTripData(offer.chat_id);
  }

  async getOfferById(offerId: string, userId: string) {
    const offer = await this.prisma.shippingOffer.findUnique({
      where: { id: offerId },
      include: {
        traveler: { select: { id: true, username: true, picture: true } },
        shipping_request: { select: { id: true, user_id: true } },
      },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    const isTraveler = offer.traveler_id === userId;
    const isRequestOwner = offer.shipping_request?.user_id === userId;

    if (!isTraveler && !isRequestOwner) {
      throw new ForbiddenException({ code: 'NOT_AUTHORIZED_TO_VIEW_OFFER' });
    }

    return {
      id: offer.id,
      shippingRequestId: offer.shipping_request_id,
      travelerId: offer.traveler_id,
      traveler: offer.traveler,
      rewardAmount: offer.reward_amount,
      message: offer.message,
      travelDate: offer.travel_date,
      status: offer.status,
      chatId: offer.chat_id,
      createdAt: offer.created_at,
      acceptedAt: offer.accepted_at,
      rejectedAt: offer.rejected_at,
      cancelledAt: offer.cancelled_at,
    };
  }

  async getMyOffers(userId: string) {
    const offers = await this.prisma.shippingOffer.findMany({
      where: { traveler_id: userId },
      include: {
        shipping_request: {
          select: {
            id: true,
            from: true,
            to: true,
            traveler_reward: true,
            status: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return offers.map((o) => ({
      id: o.id,
      shippingRequestId: o.shipping_request_id,
      shippingRequest: o.shipping_request,
      rewardAmount: o.reward_amount,
      message: o.message,
      travelDate: o.travel_date,
      status: o.status,
      chatId: o.chat_id,
      createdAt: o.created_at,
    }));
  }

  /**
   * Withdraw an offer created by the traveler. This follows the same rules
   * as `cancelOffer` (traveler can cancel pending offers). Kept as a separate
   * method for clarity and to match controller routes.
   */
  async withdrawOffer(offerId: string, userId: string, dto: WithdrawOfferDto) {
    return this.cancelOffer(offerId, userId, dto);
  }

  async cancelOffer(offerId: string, userId: string, dto: WithdrawOfferDto) {
    const offer = await this.prisma.shippingOffer.findUnique({
      where: { id: offerId },
      include: { shipping_request: { select: { user_id: true } } },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.traveler_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_OFFER_OWNER' });
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'CANNOT_CANCEL_OFFER',
        message: 'Only pending offers can be cancelled',
      });
    }

    const updated = await this.prisma.shippingOffer.update({
      where: { id: offerId },
      data: { status: 'CANCELLED', cancelled_at: new Date() },
    });

    // Send automatic cancellation message to chat if chat exists
    if (offer.chat_id) {
      try {
        const cancellationMessage = {
          status: 'CANCELLED',
          offerId: offer.id,
          cancelledAt: new Date().toISOString(),
          reason: dto.reason,
        };

        await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chat_id,
          senderId: userId,
          content: `Offer Cancelled - The traveler cancelled their shipping offer${dto.reason ? ': ' + dto.reason : ''}.`,
          type: PrismaMessageType.SHIPPING,
          messageData: cancellationMessage,
        });

        this.logger.log(
          `Sent cancellation message to chat ${offer.chat_id} for shipping offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send cancellation message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return {
      id: updated.id,
      shippingRequestId: updated.shipping_request_id,
      travelerId: updated.traveler_id,
      rewardAmount: updated.reward_amount,
      message: updated.message,
      travelDate: updated.travel_date,
      status: updated.status,
      chatId: updated.chat_id,
      cancelledAt: updated.cancelled_at,
      createdAt: updated.created_at,
    };
  }

  async acceptOffer(offerId: string, userId: string) {
    const offer = await this.prisma.shippingOffer.findUnique({
      where: { id: offerId },
      include: { shipping_request: true },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.shipping_request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'CANNOT_ACCEPT_OFFER',
        message: 'Only pending offers can be accepted',
      });
    }

    if (offer.shipping_request.status !== 'PUBLISHED') {
      throw new BadRequestException({
        code: 'REQUEST_NOT_ACTIVE',
        message: 'Shipping request is not in a state to accept offers',
      });
    }

    // Set this offer to ACCEPTED and mark shipping request as OFFER_ACCEPTED
    const updatedOffer = await this.prisma.$transaction(async (tx) => {
      // Get other pending offers to send rejection messages
      const otherOffers = await tx.shippingOffer.findMany({
        where: {
          shipping_request_id: offer.shipping_request_id,
          status: 'PENDING',
          NOT: { id: offerId },
        },
        select: {
          id: true,
          chat_id: true,
          traveler_id: true,
          reward_amount: true,
        },
      });

      // Reject other pending offers for this request
      await tx.shippingOffer.updateMany({
        where: {
          shipping_request_id: offer.shipping_request_id,
          status: 'PENDING',
          NOT: { id: offerId },
        },
        data: { status: 'REJECTED', rejected_at: new Date() },
      });

      const o = await tx.shippingOffer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED', accepted_at: new Date() },
      });

      await tx.shippingRequest.update({
        where: { id: offer.shipping_request_id },
        data: { status: 'OFFER_ACCEPTED' },
      });

      // Send rejection messages to other offers
      for (const otherOffer of otherOffers) {
        if (otherOffer.chat_id) {
          try {
            const rejectionMessage = {
              status: 'REJECTED',
              offerId: otherOffer.id,
              rejectedAt: new Date().toISOString(),
              reason: 'Another offer was accepted',
            };

            await tx.message.create({
              data: {
                content: `Offer Declined - Unfortunately, the requester declined your shipping offer of €${Number(otherOffer.reward_amount).toFixed(2)}.`,
                type: 'SHIPPING',
                chat_id: otherOffer.chat_id,
                sender_id: userId,
                data: rejectionMessage,
              },
            });

            this.logger.log(
              `Sent auto-rejection message to chat ${otherOffer.chat_id} for shipping offer ${otherOffer.id}`,
            );
          } catch (err) {
            this.logger.warn(
              `Failed to send rejection message to chat ${otherOffer.chat_id}: ${(err as Error)?.message || err}`,
            );
          }
        }
      }

      return o;
    });

    // Send automatic acceptance message to chat if chat exists
    if (offer.chat_id) {
      try {
        const reward = Number(offer.reward_amount);

        const acceptanceMessage = {
          status: 'ACCEPTED',
          totalAmount: reward,
          currency: 'EUR',
          reward,
          offerId: offer.id,
          acceptedAt: new Date().toISOString(),
        };

        // Get requester info
        const requester = await this.prisma.user.findUnique({
          where: { id: offer.shipping_request.user_id },
          select: { username: true, email: true },
        });

        await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chat_id,
          senderId: userId,
          content: `Offer Accepted - ${requester?.username || requester?.email || 'Requester'} accepted your shipping offer of €${reward.toFixed(2)}. Waiting for payment.`,
          type: PrismaMessageType.SHIPPING,
          messageData: acceptanceMessage,
        });

        this.logger.log(
          `Sent acceptance message to chat ${offer.chat_id} for shipping offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send acceptance message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return {
      id: updatedOffer.id,
      shippingRequestId: updatedOffer.shipping_request_id,
      travelerId: updatedOffer.traveler_id,
      rewardAmount: updatedOffer.reward_amount,
      message: updatedOffer.message,
      travelDate: updatedOffer.travel_date,
      status: updatedOffer.status,
      chatId: updatedOffer.chat_id,
      acceptedAt: updatedOffer.accepted_at,
      createdAt: updatedOffer.created_at,
    };
  }

  async rejectOffer(offerId: string, userId: string) {
    const offer = await this.prisma.shippingOffer.findUnique({
      where: { id: offerId },
      include: { shipping_request: true },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.shipping_request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'CANNOT_REJECT_OFFER',
        message: 'Only pending offers can be rejected',
      });
    }

    const updated = await this.prisma.shippingOffer.update({
      where: { id: offerId },
      data: { status: 'REJECTED', rejected_at: new Date() },
    });

    // Send automatic rejection message to chat if chat exists
    if (offer.chat_id) {
      try {
        const reward = Number(offer.reward_amount);

        const rejectionMessage = {
          status: 'REJECTED',
          offerId: offer.id,
          rejectedAt: new Date().toISOString(),
        };

        await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chat_id,
          senderId: userId,
          content: `Offer Declined - Unfortunately, the requester declined your shipping offer of €${reward.toFixed(2)}.`,
          type: PrismaMessageType.SHIPPING,
          messageData: rejectionMessage,
        });

        this.logger.log(
          `Sent rejection message to chat ${offer.chat_id} for shipping offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send rejection message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return {
      id: updated.id,
      shoppingRequestId: updated.shipping_request_id,
      travelerId: updated.traveler_id,
      rewardAmount: updated.reward_amount,
      message: updated.message,
      travelDate: updated.travel_date,
      status: updated.status,
      chatId: updated.chat_id,
      rejectedAt: updated.rejected_at,
      createdAt: updated.created_at,
    };
  }
}
