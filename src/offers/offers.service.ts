import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { CreateOfferDto } from './dto/create-offer.dto';
import { Decimal } from 'generated/prisma/runtime/library';
import { ShoppingRequestStatus } from 'generated/prisma';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);
  private readonly SUGGESTED_REWARD_PERCENTAGE = 15; // 15% suggested

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(forwardRef(() => ChatService)) private readonly chatService: ChatService,
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
        message: await this.i18n.translate('translation.errors.shopping_request.not_found', { lang }),
      });
    }

    if (request.user_id === userId) {
      throw new ForbiddenException({ code: 'CANNOT_OFFER_OWN_REQUEST', message: await this.i18n.translate('translation.errors.offers.cannot_offer_own_request', { lang }) });
    }

    if (request.status !== ShoppingRequestStatus.PUBLISHED) {
      throw new BadRequestException({ code: 'REQUEST_NOT_PUBLISHED', message: await this.i18n.translate('translation.errors.shopping_request.not_published', { lang }) });
    }

    // Validate deliverBy
    const deliverBy = new Date(dto.deliverBy);
    if (isNaN(deliverBy.getTime())) {
      throw new BadRequestException({ code: 'INVALID_DATE', message: 'deliverBy must be a valid ISO date' });
    }

    if (request.expires_at && deliverBy > request.expires_at) {
      throw new BadRequestException({ code: 'DELIVER_BY_AFTER_EXPIRES', message: 'deliverBy must be before request expiration' });
    }

    const travelerReward = dto.travelerReward ?? Number(request.traveler_reward ?? 0);
    const rewardCurrency = dto.rewardCurrency || (request.reward_currency as any) || 'EUR';
    const additionalFees = dto.additionalFees ?? 0;

    // Persist offer
    const offer = await this.prisma.offer.create({
      data: {
        shopping_request_id: dto.requestId,
        traveler_id: userId,
        request_version: request.current_version,
        reward_amount: new Decimal(travelerReward),
        reward_currency: rewardCurrency as any,
        additional_fees: new Decimal(additionalFees),
        travel_date: deliverBy,
        // persist optional message from DTO
        message: dto.message || null,
        status: 'PENDING',
      },
    });

    // Try to create or return existing chat between traveler and request owner
    // Do not fail the offer creation if chat creation fails
    try {
      await this.chatService.createChat(
        {
          otherUserId: request.user_id,
          messageContent: offer.message || undefined,
        },
        userId,
        lang,
      );
    } catch (err) {
      this.logger.warn(`Failed to create chat for offer ${offer.id}: ${(err as Error)?.message || err}`);
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
      createdAt: offer.created_at,
    };
  }

  async getOffersForRequest(shoppingRequestId: string, userId: string) {
    // Ensure request exists and belongs to user
    const request = await this.prisma.shoppingRequest.findUnique({ where: { id: shoppingRequestId } });
    if (!request) {
      throw new NotFoundException({ code: 'SHOPPING_REQUEST_NOT_FOUND' });
    }

    if (request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    const offers = await this.prisma.offer.findMany({
      where: { shopping_request_id: shoppingRequestId },
      include: { traveler: { select: { id: true, username: true, picture: true } } },
      orderBy: { created_at: 'desc' },
    });

    return offers.map((o) => ({
      id: o.id,
      shoppingRequestId: o.shopping_request_id,
      travelerId: o.traveler_id,
      traveler: o.traveler,
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

  async getAllOffers() {
    const offers = await this.prisma.offer.findMany({
      include: {
        traveler: { select: { id: true, username: true, picture: true } },
        shopping_request: { select: { id: true, user_id: true, status: true } },
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
      include: { traveler: { select: { id: true, username: true, picture: true } }, shopping_request: { select: { id: true, user_id: true } } },
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
      createdAt: offer.created_at,
      acceptedAt: offer.accepted_at,
      rejectedAt: offer.rejected_at,
      cancelledAt: offer.cancelled_at,
    };
  }

  async getMyOffers(userId: string) {
    const offers = await this.prisma.offer.findMany({
      where: { traveler_id: userId },
      include: {
        shopping_request: { select: { id: true, deliver_to: true, product_price: true, status: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return offers.map((o) => ({
      id: o.id,
      shoppingRequestId: o.shopping_request_id,
      shoppingRequest: o.shopping_request,
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

  async cancelOffer(offerId: string, userId: string, dto: { reason?: string }) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.traveler_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_OFFER_OWNER' });
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException({ code: 'CANNOT_CANCEL_OFFER', message: 'Only pending offers can be cancelled' });
    }

    const updated = await this.prisma.offer.update({
      where: { id: offerId },
      data: { status: 'CANCELLED', cancelled_at: new Date() },
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

  async acceptOffer(offerId: string, userId: string) {
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

    if (offer.status !== 'PENDING') {
      throw new BadRequestException({ code: 'CANNOT_ACCEPT_OFFER', message: 'Only pending offers can be accepted' });
    }

    if (offer.shopping_request.status !== 'PUBLISHED') {
      throw new BadRequestException({ code: 'REQUEST_NOT_ACTIVE', message: 'Shopping request is not in a state to accept offers' });
    }

    // Set this offer to ACCEPTED and mark shopping request as OFFER_ACCEPTED
    const updatedOffer = await this.prisma.$transaction(async (tx) => {
      // Reject other pending offers for this request
      await tx.offer.updateMany({ where: { shopping_request_id: offer.shopping_request_id, status: 'PENDING', NOT: { id: offerId } }, data: { status: 'REJECTED', rejected_at: new Date() } });

      const o = await tx.offer.update({ where: { id: offerId }, data: { status: 'ACCEPTED', accepted_at: new Date() } });

      await tx.shoppingRequest.update({ where: { id: offer.shopping_request_id }, data: { status: 'OFFER_ACCEPTED' } });

      return o;
    });

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

  async cancelByOwner(offerId: string, userId: string, dto: { reason?: string }) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId }, include: { shopping_request: true } });
    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND' });
    }

    if (offer.shopping_request.user_id !== userId) {
      throw new ForbiddenException({ code: 'NOT_REQUEST_OWNER' });
    }

    // Only allow cancelling accepted offers by owner
    if (offer.status !== 'ACCEPTED') {
      throw new BadRequestException({ code: 'CANNOT_CANCEL_OFFER', message: 'Only accepted offers can be cancelled by the request owner' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.offer.update({ where: { id: offerId }, data: { status: 'CANCELLED', cancelled_at: new Date() } });
      await tx.shoppingRequest.update({ where: { id: offer.shopping_request_id }, data: { status: 'PUBLISHED' } });
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
}
