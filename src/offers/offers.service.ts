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
import { CreateOfferDto } from './dto/create-offer.dto';
import { Decimal } from 'generated/prisma/runtime/library';
import {
  ShoppingRequestStatus,
  MessageType as PrismaMessageType,
  OfferStatus,
} from 'generated/prisma';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { GetUserShoppingOfferQueryDto } from './dto/get-shopping-offer.dto';
import { ShippingOfferService } from 'src/shipping-offer/shipping-offer.service';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);
  private readonly SUGGESTED_REWARD_PERCENTAGE = 15; // 15% suggested

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    private readonly shippingOfferService: ShippingOfferService,
  ) {}

  async create(userId: string, dto: CreateOfferDto, lang: string) {
    // Load shopping request
    const request = await this.prisma.shoppingRequest.findUnique({
      where: { id: dto.requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'SHOPPING_REQUEST_NOT_FOUND',
        message: await this.i18n.translate(
          'translation.errors.shopping_request.not_found',
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

    if (request.status !== ShoppingRequestStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'REQUEST_NOT_PUBLISHED',
        message: await this.i18n.translate(
          'translation.errors.shopping_request.not_published',
          { lang },
        ),
      });
    }

    // Validate deliverBy
    const deliverBy = new Date(dto.deliverBy);
    if (isNaN(deliverBy.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: 'deliverBy must be a valid ISO date',
      });
    }

    if (request.expires_at && deliverBy > request.expires_at) {
      throw new BadRequestException({
        code: 'DELIVER_BY_AFTER_EXPIRES',
        message: 'deliverBy must be before request expiration',
      });
    }

    const travelerReward =
      dto.travelerReward ?? Number(request.traveler_reward ?? 0);
    const rewardCurrency =
      dto.rewardCurrency || (request.reward_currency as any) || 'EUR';
    const additionalFees = dto.additionalFees ?? 0;

    let chatId: string | null = null;

    // STEP 1: Check if a chat already exists for this request between these two users (from pre-offer messaging)
    const existingRequestChat = await this.prisma.chat.findFirst({
      where: {
        shopping_request_id: dto.requestId,
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
      this.logger.log(
        `Found existing pre-offer chat ${existingRequestChat.id} for traveler ${userId} on request ${dto.requestId} - will NOT assign it to the new offer`,
      );
      // Optionally send the offer message to the existing pre-offer chat if provided
      if (dto.message) {
        try {
          await this.chatGateway.sendMessageProgrammatically({
            chatId: existingRequestChat.id,
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
    }

    // STEP 2: Check if traveler already has an active offer for this request
    // Allow creating a new offer if the previous one was CANCELLED or REJECTED.
    const activeStatuses: OfferStatus[] = [
      OfferStatus.PENDING,
      OfferStatus.ACCEPTED,
      OfferStatus.DELIVERED,
      OfferStatus.COMPLETED,
    ];
    const existingOffer = await this.prisma.offer.findFirst({
      where: {
        shopping_request_id: dto.requestId,
        traveler_id: userId,
        status: { in: activeStatuses },
      },
    });

    if (existingOffer) {
      // Prevent duplicate active offers by the same traveler for the same request
      throw new BadRequestException({
        code: 'OFFER_ALREADY_EXISTS',
        message: 'Traveler already has an active offer for this request',
      });
    }

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

      // Update chat type and link to shopping request
      await this.prisma.chat.update({
        where: { id: chatId },
        data: {
          type: 'SHOPPING',
          shopping_request_id: dto.requestId,
        },
      });

      this.logger.log(
        `Created new chat ${chatId} for offer on request ${dto.requestId}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to create chat for offer: ${(err as Error)?.message || err}`,
      );
      // Continue without chat - it's not critical
    }

    // Persist offer with linked chat
    const offer = await this.prisma.offer.create({
      data: {
        shopping_request_id: dto.requestId,
        traveler_id: userId,
        request_version: request.current_version,
        reward_amount: new Decimal(travelerReward),
        reward_currency: rewardCurrency as any,
        additional_fees: new Decimal(additionalFees),
        travel_date: deliverBy,
        message: dto.message || null,
        status: 'PENDING',
        chat_id: chatId, // Link the chat to this offer
      },
    });

    // Send automatic payment message to chat if chat exists
    if (chatId) {
      try {
        const productPrice = Number(request.product_price || 0);
        const shippingAndCustoms = Number(additionalFees);
        const reward = Number(travelerReward);
        const totalAmount = productPrice + shippingAndCustoms + reward;

        const paymentMessage = {
          status: 'PENDING',
          totalAmount,
          currency: rewardCurrency,
          productPrice,
          shippingAndCustoms,
          reward,
          offerId: offer.id,
          travelDate: deliverBy.toISOString(),
        };

        await this.chatGateway.sendMessageProgrammatically({
          chatId,
          senderId: userId,
          content: `Offer Pending - Payment Requested: ${rewardCurrency}${totalAmount.toFixed(2)}`,
          type: PrismaMessageType.SHOPPING,
          messageData: paymentMessage,
        });

        this.logger.log(
          `Sent payment message to chat ${chatId} for offer ${offer.id}`,
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
      shoppingRequestId: offer.shopping_request_id,
      travelerId: offer.traveler_id,
      requestVersion: offer.request_version,
      rewardAmount: offer.reward_amount,
      rewardCurrency: offer.reward_currency,
      additionalFees: offer.additional_fees,
      message: offer.message,
      travelDate: offer.travel_date,
      status: offer.status,
      chatId: offer.chat_id, // Include chat ID for client
      createdAt: offer.created_at,
    };
  }

  async getOffersForRequest(
    shoppingRequestId: string,
    userId: string,
    query: GetUserShoppingOfferQueryDto,
  ) {
    // Ensure request exists and belongs to user
    const request = await this.prisma.shoppingRequest.findUnique({
      where: { id: shoppingRequestId },
    });
    if (!request) {
      throw new NotFoundException({ code: 'SHOPPING_REQUEST_NOT_FOUND' });
    }

    if (request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.offer.findMany({
        where: { shopping_request_id: shoppingRequestId, status },
        include: {
          traveler: {
            select: {
              id: true,
              username: true,
              picture: true,
              firstName: true,
              lastName: true,
            },
          },
          shopping_request: {
            include: {
              products: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  picture: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.offer.count({
        where: { shopping_request_id: shoppingRequestId, status },
      }),
    ]);

    const travelerIds = Array.from(new Set(data.map((o) => o.traveler_id)));

    const stats =
      await this.shippingOfferService.getTravelersStats(travelerIds);

    return {
      data,
      stats,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Return chat information for a given offer id if the caller is a member (traveler or request owner)
   */
  async getChatForOffer(offerId: string, userId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { shopping_request: { select: { user_id: true } } },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    const isMember =
      offer.traveler_id === userId ||
      offer.shopping_request?.user_id === userId;
    if (!isMember) {
      throw new ForbiddenException({ code: 'NOT_OFFER_MEMBER' });
    }

    if (!offer.chat_id) {
      throw new NotFoundException({ code: 'CHAT_NOT_FOUND' });
    }

    // Use chatService to fetch chat details (includes request/trip data)
    return this.chatService.getChatWithRequestAndTripData(offer.chat_id);
  }

  async getAllOffers() {
    const offers = await this.prisma.offer.findMany({
      include: {
        traveler: { select: { id: true, username: true, picture: true } },
        shopping_request: {
          include: {
            products: true,
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                picture: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return offers.map((o) => ({
      id: o.id,
      shoppingRequestId: o.shopping_request_id,
      travelerId: o.traveler_id,
      traveler: (o as { traveler?: unknown }).traveler,
      shoppingRequest: (o as { shopping_request?: unknown }).shopping_request,
      requestVersion: o.request_version,
      rewardAmount: o.reward_amount,
      rewardCurrency: o.reward_currency,
      additionalFees: o.additional_fees,
      message: o.message,
      travelDate: o.travel_date,
      status: o.status,
      createdAt: o.created_at,
    }));
  }

  async getOfferById(offerId: string, userId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        traveler: { select: { id: true, username: true, picture: true } },
        shopping_request: {
          include: {
            products: true,
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                picture: true,
              },
            },
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    const isTraveler = offer.traveler_id === userId;
    const isRequestOwner = offer.shopping_request?.user_id === userId;

    if (!isTraveler && !isRequestOwner) {
      throw new ForbiddenException({ code: 'NOT_AUTHORIZED_TO_VIEW_OFFER' });
    }

    return {
      id: offer.id,
      shoppingRequestId: offer.shopping_request_id,
      travelerId: offer.traveler_id,
      traveler: offer.traveler,
      requestVersion: offer.request_version,
      rewardAmount: offer.reward_amount,
      rewardCurrency: offer.reward_currency,
      additionalFees: offer.additional_fees,
      message: offer.message,
      travelDate: offer.travel_date,
      status: offer.status,
      chatId: offer.chat_id, // Include chat ID for client
      createdAt: offer.created_at,
      acceptedAt: offer.accepted_at,
      rejectedAt: offer.rejected_at,
      cancelledAt: offer.cancelled_at,
    };
  }

  async getMyOffers(userId: string, query: GetUserShoppingOfferQueryDto) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.offer.findMany({
        where: { traveler_id: userId, status },
        include: {
          shopping_request: {
            include: {
              products: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.offer.count({
        where: { traveler_id: userId, status },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async cancelOffer(offerId: string, userId: string, dto: { reason?: string }) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        shopping_request: { select: { user_id: true, product_price: true } },
      },
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

    const updated = await this.prisma.offer.update({
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
          content: `Offer Cancelled - The traveler cancelled their offer${dto.reason ? ': ' + dto.reason : ''}.`,
          type: PrismaMessageType.SHOPPING,
          messageData: cancellationMessage,
        });

        this.logger.log(
          `Sent cancellation message to chat ${offer.chat_id} for offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send cancellation message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return {
      id: updated.id,
      shoppingRequestId: updated.shopping_request_id,
      travelerId: updated.traveler_id,
      requestVersion: updated.request_version,
      rewardAmount: updated.reward_amount,
      rewardCurrency: updated.reward_currency,
      additionalFees: updated.additional_fees,
      message: updated.message,
      travelDate: updated.travel_date,
      status: updated.status,
      cancelledAt: updated.cancelled_at,
      createdAt: updated.created_at,
    };
  }

  /**
   * Rate traveler by offer id. Validates that the caller is the owner of the shopping request
   * that the offer belongs to, then creates a rating record.
   */
  async rateTravelerByOfferId(
    userId: string,
    offerId: string,
    dto: { rating: number; review?: string },
    lang: string,
  ) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { shopping_request: { select: { id: true, user_id: true } } },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    const request = offer.shopping_request;
    if (!request) {
      throw new NotFoundException({ code: 'SHOPPING_REQUEST_NOT_FOUND' });
    }

    if (request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    // Optionally prevent duplicate ratings for same (giver, receiver, shopping_request)
    const exists = await this.prisma.rating.findFirst({
      where: {
        giver_id: userId,
        receiver_id: offer.traveler_id,
        shopping_request_id: request.id,
      },
    });
    if (exists) {
      throw new BadRequestException({ code: 'ALREADY_RATED' });
    }

    // Create rating for shopping request — trip_id may be null now that schema allows it
    const created = await this.prisma.rating.create({
      data: {
        giver_id: userId,
        receiver_id: offer.traveler_id,
        trip_id: null,
        request_id: null,
        shopping_request_id: request.id, // Link to shopping request
        rating: dto.rating,
        comment: dto.review ?? null,
      },
    });

    return { message: 'Rating created successfully', rating: created };
  }

  /**
   * Withdraw an offer created by the traveler. This follows the same rules
   * as `cancelOffer` (traveler can cancel pending offers). Kept as a separate
   * method for clarity and to match controller routes.
   */
  async withdrawOffer(
    offerId: string,
    userId: string,
    dto: { reason?: string },
  ) {
    return this.cancelOffer(offerId, userId, dto);
  }

  async acceptOffer(offerId: string, userId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        shopping_request: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.shopping_request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'CANNOT_ACCEPT_OFFER',
        message: 'Only pending offers can be accepted',
      });
    }

    if (offer.shopping_request.status !== 'PUBLISHED') {
      throw new BadRequestException({
        code: 'REQUEST_NOT_ACTIVE',
        message: 'Shopping request is not in a state to accept offers',
      });
    }

    // Set this offer to ACCEPTED and mark shopping request as OFFER_ACCEPTED
    const updatedOffer = await this.prisma.$transaction(async (tx) => {
      // Get other pending offers to send rejection messages with full details
      const otherOffers = await tx.offer.findMany({
        where: {
          shopping_request_id: offer.shopping_request_id,
          status: 'PENDING',
          NOT: { id: offerId },
        },
        include: {
          shopping_request: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          traveler: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Reject other pending offers for this request
      await tx.offer.updateMany({
        where: {
          shopping_request_id: offer.shopping_request_id,
          status: 'PENDING',
          NOT: { id: offerId },
        },
        data: { status: 'REJECTED', rejected_at: new Date() },
      });

      const o = await tx.offer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED', accepted_at: new Date() },
      });

      await tx.shoppingRequest.update({
        where: { id: offer.shopping_request_id },
        data: { status: 'OFFER_ACCEPTED' },
      });

      // Send rejection messages to other offers
      for (const otherOffer of otherOffers) {
        if (otherOffer.chat_id) {
          try {
            const requester = otherOffer.shopping_request.user;
            const requesterName =
              requester.firstName ||
              requester.username ||
              requester.email ||
              'Shopper';
            const travelerName =
              otherOffer.traveler.firstName ||
              otherOffer.traveler.username ||
              otherOffer.traveler.email ||
              'Traveler';

            const productPrice = Number(
              otherOffer.shopping_request.product_price || 0,
            );
            const shippingAndCustoms = Number(otherOffer.additional_fees);
            const reward = Number(otherOffer.reward_amount);
            const totalAmount = productPrice + shippingAndCustoms + reward;

            const rejectionMessage = {
              status: 'REJECTED',
              offerId: otherOffer.id,
              rejectedAt: new Date().toISOString(),
              reason: 'Another offer was accepted',
              totalAmount,
              currency: otherOffer.reward_currency,
              productPrice,
              shippingAndCustoms,
              reward,
              requesterName,
              travelerName,
              requesterId: requester.id,
              travelerId: otherOffer.traveler_id,
              suggestions: [
                {
                  action: 'continue_chat',
                  text: 'Continue chatting to negotiate',
                },
                { action: 'make_better_offer', text: 'Make a better offer' },
              ],
            };

            await tx.message.create({
              data: {
                content: `Offer Declined - Unfortunately, ${requesterName} declined your offer of ${otherOffer.reward_currency}${totalAmount.toFixed(2)}.`,
                type: 'SHOPPING',
                chat_id: otherOffer.chat_id,
                sender_id: userId,
                data: rejectionMessage,
              },
            });

            this.logger.log(
              `Sent auto-rejection message to chat ${otherOffer.chat_id} for offer ${otherOffer.id}`,
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
        const productPrice = Number(offer.shopping_request.product_price || 0);
        const shippingAndCustoms = Number(offer.additional_fees);
        const reward = Number(offer.reward_amount);
        const totalAmount = productPrice + shippingAndCustoms + reward;

        // Get requester and traveler info
        const [requester, traveler] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: offer.shopping_request.user_id },
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          }),
          this.prisma.user.findUnique({
            where: { id: offer.traveler_id },
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          }),
        ]);

        const requesterName =
          requester?.firstName ||
          requester?.username ||
          requester?.email ||
          'Shopper';
        const travelerName =
          traveler?.firstName ||
          traveler?.username ||
          traveler?.email ||
          'Traveler';

        const acceptanceMessage = {
          status: 'ACCEPTED',
          totalAmount,
          currency: offer.reward_currency,
          productPrice,
          shippingAndCustoms,
          reward,
          offerId: offer.id,
          acceptedAt: new Date().toISOString(),
          requesterName,
          travelerName,
          requesterId: requester?.id,
          travelerId: offer.traveler_id,
          waitingForPayment: true,
        };

        await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chat_id,
          senderId: userId,
          content: `${requesterName} accepted your offer of ${offer.reward_currency}${totalAmount.toFixed(2)}. Waiting for ${requesterName} to proceed with the payment.`,
          type: PrismaMessageType.SHOPPING,
          messageData: acceptanceMessage,
        });

        this.logger.log(
          `Sent acceptance message to chat ${offer.chat_id} for offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send acceptance message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return {
      id: updatedOffer.id,
      shoppingRequestId: updatedOffer.shopping_request_id,
      travelerId: updatedOffer.traveler_id,
      requestVersion: updatedOffer.request_version,
      rewardAmount: updatedOffer.reward_amount,
      rewardCurrency: updatedOffer.reward_currency,
      additionalFees: updatedOffer.additional_fees,
      message: updatedOffer.message,
      travelDate: updatedOffer.travel_date,
      status: updatedOffer.status,
      acceptedAt: updatedOffer.accepted_at,
      createdAt: updatedOffer.created_at,
    };
  }

  async cancelByOwner(
    offerId: string,
    userId: string,
    dto: { reason?: string },
  ) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { shopping_request: true },
    });
    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.shopping_request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    // Only allow cancelling accepted offers by owner
    if (offer.status !== 'ACCEPTED') {
      throw new BadRequestException({
        code: 'CANNOT_CANCEL_OFFER',
        message: 'Only accepted offers can be cancelled by the request owner',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.offer.update({
        where: { id: offerId },
        data: { status: 'CANCELLED', cancelled_at: new Date() },
      });
      await tx.shoppingRequest.update({
        where: { id: offer.shopping_request_id },
        data: { status: 'PUBLISHED' },
      });
      return u;
    });

    return {
      id: updated.id,
      shoppingRequestId: updated.shopping_request_id,
      travelerId: updated.traveler_id,
      requestVersion: updated.request_version,
      rewardAmount: updated.reward_amount,
      rewardCurrency: updated.reward_currency,
      additionalFees: updated.additional_fees,
      message: updated.message,
      travelDate: updated.travel_date,
      status: updated.status,
      cancelledAt: updated.cancelled_at,
      createdAt: updated.created_at,
    };
  }

  async rejectOffer(offerId: string, userId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        shopping_request: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        traveler: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.shopping_request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'CANNOT_REJECT_OFFER',
        message: 'Only pending offers can be rejected',
      });
    }

    const rejectedAt = new Date();

    const updated = await this.prisma.offer.update({
      where: { id: offerId },
      data: { status: 'REJECTED', rejected_at: rejectedAt },
    });

    // Send automatic rejection message to chat if chat exists
    if (offer.chat_id) {
      try {
        const requester = offer.shopping_request.user;
        const requesterName =
          requester.firstName ||
          requester.username ||
          requester.email ||
          'Shopper';
        const travelerName =
          offer.traveler.firstName ||
          offer.traveler.username ||
          offer.traveler.email ||
          'Traveler';

        const productPrice = Number(offer.shopping_request.product_price || 0);
        const shippingAndCustoms = Number(offer.additional_fees);
        const reward = Number(offer.reward_amount);
        const totalAmount = productPrice + shippingAndCustoms + reward;

        const rejectionMessage = {
          status: 'REJECTED',
          offerId: offer.id,
          rejectedAt: rejectedAt.toISOString(),
          totalAmount,
          currency: offer.reward_currency,
          productPrice,
          shippingAndCustoms,
          reward,
          requesterName,
          travelerName,
          requesterId: requester.id,
          travelerId: offer.traveler_id,
          suggestions: [
            { action: 'continue_chat', text: 'Continue chatting to negotiate' },
            { action: 'make_better_offer', text: 'Make a better offer' },
          ],
        };

        await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chat_id,
          senderId: userId,
          content: `Offer Declined - Unfortunately, ${requesterName} declined your offer of ${offer.reward_currency}${totalAmount.toFixed(2)}.`,
          type: PrismaMessageType.SHOPPING,
          messageData: rejectionMessage,
        });

        this.logger.log(
          `Sent rejection message to chat ${offer.chat_id} for offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send rejection message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return {
      id: updated.id,
      shoppingRequestId: updated.shopping_request_id,
      travelerId: updated.traveler_id,
      requestVersion: updated.request_version,
      rewardAmount: updated.reward_amount,
      rewardCurrency: updated.reward_currency,
      additionalFees: updated.additional_fees,
      message: updated.message,
      travelDate: updated.travel_date,
      status: updated.status,
      chatId: updated.chat_id,
      rejectedAt: updated.rejected_at,
      createdAt: updated.created_at,
    };
  }

  async deliverOffer(
    offerId: string,
    userId: string,
    dto: { reason?: string },
  ) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        shopping_request: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.traveler_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_OFFER_OWNER' });
    }

    if (offer.status !== 'ACCEPTED') {
      throw new BadRequestException({
        code: 'CANNOT_MARK_DELIVERED',
        message: 'Only accepted offers can be marked as delivered',
      });
    }

    const deliveredAt = new Date();

    // Ensure the delivered_at column exists (some DBs/migrations may be out-of-sync).
    // Try to add the column if missing, then set status and delivered_at. If that fails,
    // fall back to updating status only so the API doesn't crash.
    let updated: any;
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);`,
      );
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Offer" SET status = 'DELIVERED', delivered_at = NOW() WHERE id = $1`,
        offerId,
      );

      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM "Offer" WHERE id = $1`,
        offerId,
      );
      updated = rows[0];
    } catch (rawErr) {
      this.logger.warn(
        `Raw DB update for delivered_at failed, falling back to status-only update: ${(rawErr as Error)?.message || rawErr}`,
      );
      // Fallback: update status only
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Offer" SET status = 'DELIVERED' WHERE id = $1`,
        offerId,
      );
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, shopping_request_id, traveler_id, request_version, reward_amount, reward_currency, additional_fees, message, travel_date, status, created_at, rejected_at FROM "Offer" WHERE id = $1`,
        offerId,
      );
      updated = rows[0];
    }

    // Send delivery report message to chat if exists
    if (offer.chat_id) {
      try {
        const requester = offer.shopping_request.user;
        const requesterName =
          requester.firstName ||
          requester.username ||
          requester.email ||
          'Shopper';

        const travelerEarnings = Number(offer.reward_amount);
        const productPrice = Number(offer.shopping_request.product_price || 0);
        const shippingAndCustoms = Number(offer.additional_fees);
        const totalAmount =
          productPrice + shippingAndCustoms + travelerEarnings;

        const deliveryMessage = {
          status: 'DELIVERED',
          offerId: offer.id,
          deliveredAt: deliveredAt.toISOString(),
          travelerEarnings,
          currency: offer.reward_currency,
          confirmationPending: true,
          requesterName,
          requesterId: requester.id,
          productPrice,
          shippingAndCustoms,
          totalAmount,
          reason: dto.reason,
        };

        const sent = await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chat_id,
          senderId: userId,
          content: `Delivery Reported - Waiting for ${requesterName} to confirm receipt. Your earnings: ${offer.reward_currency}${travelerEarnings.toFixed(2)} (Pending confirmation)`,
          type: PrismaMessageType.SHOPPING,
          messageData: deliveryMessage,
        });

        this.logger.log(
          `Sent delivery report message to chat ${offer.chat_id} for offer ${offer.id} - message id: ${sent?.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send delivery message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return {
      id: updated.id,
      shoppingRequestId: updated.shopping_request_id,
      travelerId: updated.traveler_id,
      requestVersion: updated.request_version,
      rewardAmount: updated.reward_amount,
      rewardCurrency: updated.reward_currency,
      additionalFees: updated.additional_fees,
      message: updated.message,
      travelDate: updated.travel_date,
      status: updated.status,
      deliveredAt: updated.delivered_at,
      chatId: updated.chat_id || offer.chat_id,
      createdAt: updated.created_at,
    };
  }

  /**
   * Confirm delivery by request owner. Requires offer.status === 'DELIVERED'.
   * Updates shopping request delivered_at and status, sets offer.status = 'COMPLETED'.
   */
  async confirmDelivery(
    offerId: string,
    userId: string,
    dto: { reason?: string },
  ) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        shopping_request: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        traveler: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.shopping_request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    if (offer.status !== 'DELIVERED') {
      throw new BadRequestException({
        code: 'CANNOT_CONFIRM_DELIVERY',
        message:
          'Offer must be marked DELIVERED by traveler before confirmation',
      });
    }

    const confirmedAt = new Date();

    // Use raw queries as Prisma client may not be regenerated yet for new enum/columns
    await this.prisma.$executeRawUnsafe(
      `UPDATE "Offer" SET status = 'COMPLETED' WHERE id = $1`,
      offerId,
    );

    await this.prisma.$executeRawUnsafe(
      `UPDATE "ShoppingRequest" SET status = 'DELIVERED', delivered_at = NOW() WHERE id = $1`,
      offer.shopping_request_id,
    );

    // Fetch updated offer row
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "Offer" WHERE id = $1`,
      offerId,
    );
    const updated = rows[0];

    // Send delivery confirmation message to chat if exists
    if (offer.chat_id) {
      try {
        const requester = offer.shopping_request.user;
        const requesterName =
          requester.firstName ||
          requester.username ||
          requester.email ||
          'Shopper';
        const travelerName =
          offer.traveler.firstName ||
          offer.traveler.username ||
          offer.traveler.email ||
          'Traveler';

        const travelerEarnings = Number(offer.reward_amount);
        const productPrice = Number(offer.shopping_request.product_price || 0);
        const shippingAndCustoms = Number(offer.additional_fees);
        const totalAmount =
          productPrice + shippingAndCustoms + travelerEarnings;

        const confirmMessage = {
          status: 'COMPLETED',
          offerId: offer.id,
          confirmedAt: confirmedAt.toISOString(),
          travelerEarnings,
          currency: offer.reward_currency,
          confirmationCompleted: true,
          deliveryComplete: true,
          requesterName,
          travelerName,
          requesterId: requester.id,
          travelerId: offer.traveler_id,
          productPrice,
          shippingAndCustoms,
          totalAmount,
          reason: dto.reason,
          promptReview: true,
        };

        await this.chatGateway.sendMessageProgrammatically({
          chatId: offer.chat_id,
          senderId: userId,
          content: `Delivery Complete! You've successfully delivered ${requesterName}'s packages. Please rate your experience with ${travelerName}.`,
          type: PrismaMessageType.SHOPPING,
          messageData: confirmMessage,
        });

        this.logger.log(
          `Sent delivery complete message to chat ${offer.chat_id} for offer ${offer.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send delivery complete message to chat: ${(err as Error)?.message || err}`,
        );
      }
    }

    return {
      id: updated.id,
      shoppingRequestId: updated.shopping_request_id,
      travelerId: updated.traveler_id,
      requestVersion: updated.request_version,
      rewardAmount: updated.reward_amount,
      rewardCurrency: updated.reward_currency,
      additionalFees: updated.additional_fees,
      message: updated.message,
      travelDate: updated.travel_date,
      status: updated.status,
      createdAt: updated.created_at,
    };
  }
}
