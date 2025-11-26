import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateTripDto, CreateTripResponseDto } from './dto/create-trip.dto';
import { UpdateTripDto, UpdateTripResponseDto } from './dto/update-trip.dto';
import {
  CreateTransportTypeDto,
  CreateTransportTypeResponseDto,
} from './dto/create-transport-type.dto';
import {
  UpdateTransportTypeDto,
  UpdateTransportTypeResponseDto,
} from './dto/update-transport-type.dto';
import {
  CreateTripItemDto,
  CreateTripItemResponseDto,
} from './dto/create-trip-item.dto';
import {
  UpdateTripItemDto,
  UpdateTripItemResponseDto,
} from './dto/update-trip-item.dto';
import { GetTripsQueryDto, GetTripsResponseDto } from './dto/get-trips.dto';
import {
  GetTransportTypesQueryDto,
  GetTransportTypesResponseDto,
} from './dto/get-transport-types.dto';
import {
  GetTripItemsQueryDto,
  GetTripItemsResponseDto,
} from './dto/get-trip-items.dto';
import { GetTripByIdResponseDto } from './dto/get-trip-by-id.dto';
import {
  CreateAirlineDto,
  CreateAirlineResponseDto,
} from './dto/create-airline.dto';
import {
  GetAirlinesQueryDto,
  GetAirlinesResponseDto,
} from './dto/get-airlines.dto';
import { CreateAlertDto, CreateAlertResponseDto } from './dto/create-alert.dto';
import { UpdateAlertDto, UpdateAlertResponseDto } from './dto/update-alert.dto';
import { DeleteAlertResponseDto } from './dto/delete-alert.dto';
import { GetAlertsQueryDto, GetAlertsResponseDto } from './dto/get-alerts.dto';
import {
  GetUserTripsQueryDto,
  GetUserTripsResponseDto,
} from './dto/get-user-trips.dto';
import { GetUserTripDetailResponseDto } from './dto/get-user-trip-detail.dto';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { NotificationService } from '../notification/notification.service';
import { RequestService } from '../request/request.service';
import { ChatGateway } from '../chat/chat.gateway';
import { StripeService } from '../payment/stripe.service';
import { WalletService } from '../wallet/wallet.service';
import { CurrencyService } from '../currency/currency.service';
import { ImageService } from '../shared/services/image.service';
import {
  UserRole,
  TripStatus,
  RequestStatus,
  Currency,
  Language,
} from 'generated/prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class TripService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly notificationService: NotificationService,
    private readonly requestService: RequestService,
    private readonly chatGateway: ChatGateway,
    private readonly stripeService: StripeService,
    private readonly walletService: WalletService,
    private readonly currencyService: CurrencyService,
    private readonly imageService: ImageService,
  ) {}

  async createTrip(
    createTripDto: CreateTripDto,
    userId: string,
    lang?: string,
  ): Promise<CreateTripResponseDto> {
    const { mode_of_transport_id, airline_id, trip_items, ...tripData } =
      createTripDto;

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const message = await this.i18n.translate(
        'translation.trip.create.userNotFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Admins cannot create trips
    if (user.role === UserRole.ADMIN) {
      const message = await this.i18n.translate(
        'translation.trip.create.adminCannotCreate',
        {
          lang,
          defaultValue: 'Admins are not allowed to create trips',
        },
      );
      throw new ForbiddenException(message);
    }

    // Check if transport type exists (only if provided)
    if (mode_of_transport_id) {
      const transportType = await this.prisma.transportType.findUnique({
        where: { id: mode_of_transport_id },
      });

      if (!transportType) {
        const message = await this.i18n.translate(
          'translation.trip.create.transportNotFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }
    }

    // Check if airline exists
    const airline = await this.prisma.airline.findUnique({
      where: { id: airline_id },
    });

    if (!airline) {
      const message = await this.i18n.translate(
        'translation.trip.create.airlineNotFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Validate trip items - at least one item is always required
    if (!trip_items || trip_items.length === 0) {
      const message = await this.i18n.translate(
        'translation.trip.create.tripItemsRequired',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    // Validate trip items exist in database
    const tripItemIds = trip_items.map((item) => item.trip_item_id);
    const existingTripItems = await this.prisma.tripItem.findMany({
      where: { id: { in: tripItemIds } },
      select: { id: true },
    });

    if (existingTripItems.length !== tripItemIds.length) {
      const message = await this.i18n.translate(
        'translation.trip.create.tripItemNotFound',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    // Validate status - only DRAFT is allowed when creating a trip (if provided)
    // Default is SCHEDULED if not provided
    if (tripData.status && tripData.status !== TripStatus.DRAFT) {
      const message = await this.i18n.translate(
        'translation.trip.create.onlyDraftAllowed',
        {
          lang,
          defaultValue:
            'Only DRAFT status can be passed when creating a trip. Default is SCHEDULED.',
        },
      );
      throw new BadRequestException(message);
    }

    // Set status: use DRAFT if provided, otherwise default to SCHEDULED
    const tripStatus = tripData.status || TripStatus.SCHEDULED;

    try {
      // Create trip with trip items in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the trip
        const trip = await prisma.trip.create({
          data: {
            user_id: userId,
            mode_of_transport_id: mode_of_transport_id || null,
            airline_id,
            pickup: tripData.pickup,
            destination: tripData.destination,
            departure: tripData.departure,
            departure_date: new Date(tripData.departure_date),
            departure_time: tripData.departure_time,
            arrival_date: tripData.arrival_date
              ? new Date(tripData.arrival_date)
              : null,
            arrival_time: tripData.arrival_time || null,
            maximum_weight_in_kg: tripData.maximum_weight_in_kg || null,
            notes: tripData.notes || null,
            meetup_flexible: tripData.meetup_flexible || false,
            currency: tripData.currency as Currency,
            status: tripStatus,
          },
          select: {
            id: true,
            user_id: true,
            departure_date: true,
            departure_time: true,
            arrival_date: true,
            arrival_time: true,
            currency: true,
            airline_id: true,
            createdAt: true,
          },
        });

        // Create trip items (always required)
        await prisma.tripItemsList.createMany({
          data: trip_items.map((item) => ({
            trip_id: trip.id,
            trip_item_id: item.trip_item_id,
            price: item.price,
            avalailble_kg: item.available_kg || null,
          })),
        });

        // Convert prices for all supported currencies and create TripItemsListPrice entries
        const supportedCurrencies: Currency[] = [
          Currency.XAF,
          Currency.USD,
          Currency.EUR,
          Currency.CAD,
        ];
        const userCurrency = tripData.currency as Currency;

        // Prepare all price entries for all currencies
        const priceEntries: Array<{
          trip_id: string;
          trip_item_id: string;
          currency: Currency;
          price: number;
        }> = [];

        for (const item of trip_items) {
          for (const targetCurrency of supportedCurrencies) {
            const conversion = this.currencyService.convertCurrency(
              Number(item.price),
              userCurrency,
              targetCurrency,
            );
            priceEntries.push({
              trip_id: trip.id,
              trip_item_id: item.trip_item_id,
              currency: targetCurrency,
              price: conversion.convertedAmount,
            });
          }
        }

        // Create all price entries
        if (priceEntries.length > 0) {
          await prisma.tripItemsListPrice.createMany({
            data: priceEntries,
          });
        }

        return {
          trip,
          trip_items,
        };
      });

      // Alert checking is now handled by the hourly scheduler

      // Send push notifications to all app users (non-blocking)
      // Only send if trip status is not DRAFT (DRAFT trips are not visible to others)
      if (tripStatus !== TripStatus.DRAFT) {
        this.sendNewTripNotificationToAllUsers(result.trip, tripData).catch(
          (error) => {
            console.error('Failed to send new trip notifications:', error);
            // Don't fail trip creation if notifications fail
          },
        );
      }

      const message = await this.i18n.translate(
        'translation.trip.create.success',
        {
          lang,
        },
      );

      return {
        message,
        trip: {
          ...result.trip,
          trip_items: result.trip_items,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.trip.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateTrip(
    tripId: string,
    updateTripDto: UpdateTripDto,
    userId: string,
    lang?: string,
  ): Promise<UpdateTripResponseDto> {
    // Check if trip exists
    const existingTrip = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!existingTrip) {
      const message = await this.i18n.translate(
        'translation.trip.update.notFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Check if user is authorized to update this trip
    if (existingTrip.user_id !== userId) {
      const message = await this.i18n.translate(
        'translation.trip.update.unauthorized',
        {
          lang,
        },
      );
      throw new ForbiddenException(message);
    }

    try {
      const updateData: any = { ...updateTripDto };
      const { trip_items, ...tripUpdateData } = updateData;

      // Remove status from updateData - users cannot update status directly
      delete tripUpdateData.status;

      // Convert departure_date string to Date if provided
      if (tripUpdateData.departure_date) {
        tripUpdateData.departure_date = new Date(tripUpdateData.departure_date);
      }

      // Convert arrival_date string to Date if provided
      if (tripUpdateData.arrival_date) {
        tripUpdateData.arrival_date = new Date(tripUpdateData.arrival_date);
      }

      // Store departure and arrival dates in variables
      // Use new values if provided, otherwise use existing values
      let departureDate = tripUpdateData.departure_date
        ? new Date(tripUpdateData.departure_date)
        : new Date(existingTrip.departure_date);

      let arrivalDate =
        tripUpdateData.arrival_date !== undefined
          ? tripUpdateData.arrival_date
            ? new Date(tripUpdateData.arrival_date)
            : null
          : existingTrip.arrival_date
            ? new Date(existingTrip.arrival_date)
            : null;

      // Normalize dates to midnight for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      departureDate.setHours(0, 0, 0, 0);
      if (arrivalDate) {
        arrivalDate.setHours(0, 0, 0, 0);
      }

      // Validate departure_date is greater than today
      if (departureDate <= today) {
        const message = await this.i18n.translate(
          'translation.trip.update.departureDateMustBeInFuture',
          {
            lang,
            defaultValue: 'Departure date must be greater than today',
          },
        );
        throw new BadRequestException(message);
      }

      // Validate arrival_date is greater than departure_date (if arrival_date exists)
      if (arrivalDate && arrivalDate <= departureDate) {
        const message = await this.i18n.translate(
          'translation.trip.update.arrivalDateMustBeAfterDeparture',
          {
            lang,
            defaultValue: 'Arrival date must be greater than departure date',
          },
        );
        throw new BadRequestException(message);
      }

      // Handle JSON fields properly
      if (tripUpdateData.pickup !== undefined) {
        tripUpdateData.pickup = tripUpdateData.pickup || null;
      }
      if (tripUpdateData.destination !== undefined) {
        tripUpdateData.destination = tripUpdateData.destination || null;
      }

      // Check if schedule-related fields have changed
      let scheduleChanged = false;

      // Check departure_date
      if (tripUpdateData.departure_date) {
        const existingDate = new Date(existingTrip.departure_date);
        const newDate = new Date(tripUpdateData.departure_date);
        if (existingDate.getTime() !== newDate.getTime()) {
          scheduleChanged = true;
        }
      }

      // Check departure_time
      if (
        tripUpdateData.departure_time !== undefined &&
        tripUpdateData.departure_time !== existingTrip.departure_time
      ) {
        scheduleChanged = true;
      }

      // Check arrival_date
      if (tripUpdateData.arrival_date !== undefined) {
        const existingArrivalDate = existingTrip.arrival_date
          ? new Date(existingTrip.arrival_date).getTime()
          : null;
        const newArrivalDate = tripUpdateData.arrival_date
          ? new Date(tripUpdateData.arrival_date).getTime()
          : null;

        if (existingArrivalDate !== newArrivalDate) {
          scheduleChanged = true;
        }
      }

      // Check arrival_time
      if (
        tripUpdateData.arrival_time !== undefined &&
        tripUpdateData.arrival_time !== existingTrip.arrival_time
      ) {
        scheduleChanged = true;
      }

      // If any schedule field changed, change status to RESCHEDULED
      if (scheduleChanged) {
        tripUpdateData.status = 'RESCHEDULED';
      }

      // Validate airline_id if provided
      if (tripUpdateData.airline_id !== undefined) {
        const airline = await this.prisma.airline.findUnique({
          where: { id: tripUpdateData.airline_id },
        });

        if (!airline) {
          const message = await this.i18n.translate(
            'translation.trip.update.airlineNotFound',
            {
              lang,
              defaultValue: 'Airline not found',
            },
          );
          throw new NotFoundException(message);
        }
      }

      // Validate mode_of_transport_id if provided
      if (tripUpdateData.mode_of_transport_id !== undefined) {
        if (tripUpdateData.mode_of_transport_id !== null) {
          const transportType = await this.prisma.transportType.findUnique({
            where: { id: tripUpdateData.mode_of_transport_id },
          });

          if (!transportType) {
            const message = await this.i18n.translate(
              'translation.trip.update.transportNotFound',
              {
                lang,
                defaultValue: 'Transport type not found',
              },
            );
            throw new NotFoundException(message);
          }
        }
      }

      // Validate trip items if provided
      if (trip_items !== undefined) {
        if (trip_items.length === 0) {
          const message = await this.i18n.translate(
            'translation.trip.update.tripItemsRequired',
            {
              lang,
              defaultValue: 'At least one trip item is required',
            },
          );
          throw new BadRequestException(message);
        }

        // Validate trip items exist in database
        const tripItemIds = trip_items.map((item) => item.trip_item_id);
        const existingTripItems = await this.prisma.tripItem.findMany({
          where: { id: { in: tripItemIds } },
          select: { id: true },
        });

        if (existingTripItems.length !== tripItemIds.length) {
          const message = await this.i18n.translate(
            'translation.trip.update.tripItemNotFound',
            {
              lang,
              defaultValue: 'One or more trip items not found',
            },
          );
          throw new NotFoundException(message);
        }
      }

      // Update trip and trip items in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Update the trip
        const trip = await prisma.trip.update({
          where: { id: tripId },
          data: tripUpdateData,
          select: {
            id: true,
            user_id: true,
            departure_date: true,
            departure_time: true,
            arrival_date: true,
            arrival_time: true,
            status: true,
            fully_booked: true,
            updatedAt: true,
          },
        });

        // Update trip items if provided
        if (trip_items !== undefined) {
          // Delete existing trip items
          await prisma.tripItemsList.deleteMany({
            where: { trip_id: tripId },
          });

          // Create new trip items
          if (trip_items.length > 0) {
            await prisma.tripItemsList.createMany({
              data: trip_items.map((item) => ({
                trip_id: tripId,
                trip_item_id: item.trip_item_id,
                price: item.price,
                avalailble_kg: item.available_kg || null,
              })),
            });
          }
        }

        return trip;
      });

      const message = await this.i18n.translate(
        'translation.trip.update.success',
        {
          lang,
        },
      );

      return {
        message,
        trip: result,
      };
    } catch (error) {
      // Preserve specific exceptions (NotFoundException, BadRequestException, etc.)
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      const message = await this.i18n.translate(
        'translation.trip.update.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Cancel a trip
   * Handles trip cancellation, updates related requests, processes refunds, and sends notifications
   */
  async cancelTrip(
    tripId: string,
    userId: string,
    reason: string,
    additionalNotes?: string,
    lang?: string,
  ) {
    // Check if trip exists
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        requests: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      const message = await this.i18n.translate(
        'translation.trip.cancel.notFound',
        {
          lang,
          defaultValue: 'Trip not found',
        },
      );
      throw new NotFoundException(message);
    }

    // Check if user is authorized to cancel this trip
    if (trip.user_id !== userId) {
      const message = await this.i18n.translate(
        'translation.trip.cancel.unauthorized',
        {
          lang,
          defaultValue: 'You are not authorized to cancel this trip',
        },
      );
      throw new ForbiddenException(message);
    }

    // Validate trip is not already cancelled
    if (trip.status === TripStatus.CANCELLED) {
      const message = await this.i18n.translate(
        'translation.trip.cancel.alreadyCancelled',
        {
          lang,
          defaultValue: 'Trip is already cancelled',
        },
      );
      throw new BadRequestException(message);
    }

    // Check if there are any IN_TRANSIT requests (block cancellation)
    const inTransitRequests = trip.requests.filter(
      (req) => req.status === RequestStatus.IN_TRANSIT,
    );
    if (inTransitRequests.length > 0) {
      const message = await this.i18n.translate(
        'translation.trip.cancel.hasInTransitRequests',
        {
          lang,
          defaultValue:
            'Cannot cancel trip with requests in transit. Please contact support.',
        },
      );
      throw new BadRequestException(message);
    }

    // Prepare cancellation reason
    const cancellationReason = additionalNotes
      ? `${reason}: ${additionalNotes}`
      : reason;

    try {
      // Process cancellation in transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Update trip status
        const updatedTrip = await prisma.trip.update({
          where: { id: tripId },
          data: {
            status: TripStatus.CANCELLED,
            // Note: Prisma schema doesn't have cancelledAt or cancellationReason fields
            // These would need to be added to the schema, or stored in metadata
          },
        });

        // Process all related requests
        let affectedRequests = 0;
        let refundsProcessed = 0;

        for (const request of trip.requests) {
          // Skip requests that are already cancelled, declined, or expired
          if (
            request.status === RequestStatus.CANCELLED ||
            request.status === RequestStatus.DECLINED ||
            request.status === RequestStatus.EXPIRED
          ) {
            continue;
          }

          affectedRequests++;

          // Store original status for refund logic
          const originalStatus = request.status;
          const needsRefund =
            originalStatus === RequestStatus.CONFIRMED ||
            originalStatus === RequestStatus.ACCEPTED ||
            (request.payment_status === 'SUCCEEDED' &&
              request.payment_intent_id);

          // Use changeRequestStatus to update request status to CANCELLED
          // This will handle chat messages and system notifications
          try {
            await this.requestService.changeRequestStatus(
              request.id,
              RequestStatus.CANCELLED,
              userId, // traveler ID
              lang,
            );

            // Update request with cancellation metadata
            await prisma.tripRequest.update({
              where: { id: request.id },
              data: {
                cancelled_at: new Date(),
                cancellation_type: 'TRIP_CANCELLED',
                cancellation_reason: `Trip cancelled: ${cancellationReason}`,
              },
            });
          } catch (requestError) {
            console.error(
              `Failed to update request ${request.id} status:`,
              requestError,
            );
            // Continue processing other requests
          }

          // Process refunds for paid/accepted requests (using original status)
          if (needsRefund) {
            try {
              // Get payment transaction
              const paymentTx = await prisma.transaction.findUnique({
                where: { id: request.payment_intent_id! },
                include: {
                  user: {
                    include: {
                      wallet: true,
                    },
                  },
                },
              });

              if (paymentTx && paymentTx.status === 'SUCCESS') {
                const amountPaid = Number(paymentTx.amount_requested);
                const currency = paymentTx.currency;

                // Process refund based on payment method
                if (paymentTx.provider === 'STRIPE' && paymentTx.provider_id) {
                  // Stripe refund using processCancellationOrRefund
                  try {
                    await this.stripeService.processCancellationOrRefund(
                      paymentTx.provider_id,
                      amountPaid,
                    );

                    // Update transaction status (use SUCCESS with refund metadata)
                    await prisma.transaction.update({
                      where: { id: paymentTx.id },
                      data: {
                        status: 'SUCCESS', // TransactionStatus doesn't have REFUNDED
                        description: `Refunded due to trip cancellation: ${cancellationReason}`,
                        metadata: {
                          ...((paymentTx.metadata as any) || {}),
                          refundedAt: new Date().toISOString(),
                          refundReason: 'TRIP_CANCELLED',
                          refundStatus: 'PROCESSED',
                        },
                      },
                    });

                    refundsProcessed++;
                  } catch (stripeError) {
                    console.error(
                      `Failed to process Stripe refund for transaction ${paymentTx.id}:`,
                      stripeError,
                    );
                    // Continue - manual intervention may be required
                  }
                } else {
                  // Internal wallet refund
                  const senderWallet = paymentTx.user.wallet;
                  if (senderWallet) {
                    // Credit back to sender's wallet
                    const updateData: any = {
                      available_balance_xaf:
                        currency === 'XAF'
                          ? { increment: amountPaid }
                          : undefined,
                    };

                    // Add currency-specific balance update
                    if (currency === 'EUR') {
                      updateData.available_balance_eur = {
                        increment: amountPaid,
                      };
                    } else if (currency === 'USD') {
                      updateData.available_balance_usd = {
                        increment: amountPaid,
                      };
                    } else if (currency === 'CAD') {
                      updateData.available_balance_cad = {
                        increment: amountPaid,
                      };
                    }

                    // Update generic balances if currency service is available
                    // For now, we'll update the currency-specific balance

                    await prisma.wallet.update({
                      where: { id: senderWallet.id },
                      data: updateData,
                    });

                    // Update transaction status (use SUCCESS with refund metadata)
                    await prisma.transaction.update({
                      where: { id: paymentTx.id },
                      data: {
                        status: 'SUCCESS', // TransactionStatus doesn't have REFUNDED
                        description: `Refunded due to trip cancellation: ${cancellationReason}`,
                        metadata: {
                          ...((paymentTx.metadata as any) || {}),
                          refundedAt: new Date().toISOString(),
                          refundReason: 'TRIP_CANCELLED',
                          refundMethod: 'WALLET',
                          refundStatus: 'PROCESSED',
                        },
                      },
                    });

                    // Create refund transaction record
                    await prisma.transaction.create({
                      data: {
                        userId: paymentTx.userId,
                        wallet_id: senderWallet.id,
                        amount_requested: amountPaid,
                        amount_paid: amountPaid,
                        fee_applied: 0,
                        currency: currency,
                        type: 'CREDIT',
                        source: 'REFUND',
                        status: 'SUCCESS',
                        provider: paymentTx.provider,
                        description: `Refund for cancelled trip: ${cancellationReason}`,
                        metadata: {
                          originalTransactionId: paymentTx.id,
                          tripId: tripId,
                          requestId: request.id,
                          refundReason: 'TRIP_CANCELLED',
                        },
                        balance_after:
                          Number(senderWallet.available_balance) + amountPaid,
                      },
                    });

                    refundsProcessed++;
                  }
                }
              }
            } catch (refundError) {
              console.error(
                `Failed to process refund for request ${request.id}:`,
                refundError,
              );
              // Continue processing other requests
            }
          }
        }

        // Archive all chats linked to this trip
        const chats = await prisma.chat.findMany({
          where: { trip_id: tripId },
        });

        for (const chat of chats) {
          // Send system message to chat
          try {
            await this.chatGateway.sendMessageProgrammatically({
              chatId: chat.id,
              senderId: userId,
              content: await this.i18n.translate(
                'translation.chat.messages.tripCancelled',
                {
                  lang,
                  args: { tripId, reason: cancellationReason },
                  defaultValue: `⚠️ This trip has been cancelled by the traveler. Reason: ${cancellationReason}. All related deliveries have been voided.`,
                },
              ),
              type: 'SYSTEM',
            });
          } catch (chatError) {
            console.error(
              `Failed to send system message to chat ${chat.id}:`,
              chatError,
            );
          }
        }

        return {
          trip: updatedTrip,
          affectedRequests,
          refundsProcessed,
        };
      });

      // Send notifications
      try {
        // Notify traveler (confirmation)
        await this.notificationService.createNotification(
          {
            user_id: trip.user_id,
            title: await this.i18n.translate(
              'translation.trip.cancel.notification.traveler.title',
              {
                lang,
                defaultValue: 'Trip Cancelled',
              },
            ),
            message: await this.i18n.translate(
              'translation.trip.cancel.notification.traveler.message',
              {
                lang,
                defaultValue: 'Your trip has been successfully cancelled.',
              },
            ),
            type: 'SYSTEM',
            data: {
              tripId: tripId,
              reason: cancellationReason,
              action: 'TRIP_CANCELLED',
            },
          },
          lang,
        );

        // Notify all senders with requests
        for (const request of trip.requests) {
          if (
            request.status !== RequestStatus.CANCELLED &&
            request.status !== RequestStatus.DECLINED &&
            request.status !== RequestStatus.EXPIRED
          ) {
            await this.notificationService.createNotification(
              {
                user_id: request.user_id,
                title: await this.i18n.translate(
                  'translation.trip.cancel.notification.sender.title',
                  {
                    lang,
                    defaultValue: 'Trip Cancelled',
                  },
                ),
                message: await this.i18n.translate(
                  'translation.trip.cancel.notification.sender.message',
                  {
                    lang,
                    args: {
                      tripId,
                    },
                    defaultValue: `The trip #${tripId} has been cancelled by the traveler. ${result.refundsProcessed > 0 ? 'Any payments made will be refunded.' : ''}`,
                  },
                ),
                type: 'REQUEST',
                trip_id: tripId,
                request_id: request.id,
                data: {
                  tripId: tripId,
                  requestId: request.id,
                  reason: cancellationReason,
                  refunded: result.refundsProcessed > 0,
                  action: 'TRIP_CANCELLED',
                },
              },
              lang,
            );
          }
        }
      } catch (notificationError) {
        console.error('Failed to send notifications:', notificationError);
        // Don't fail the cancellation if notifications fail
      }

      const message = await this.i18n.translate(
        'translation.trip.cancel.success',
        {
          lang,
          args: {
            affectedRequests: result.affectedRequests,
            refundsProcessed: result.refundsProcessed,
          },
          defaultValue: `Trip cancelled successfully. ${result.affectedRequests} request(s) affected. ${result.refundsProcessed} refund(s) processed.`,
        },
      );

      return {
        message,
        tripId,
        affectedRequests: result.affectedRequests,
        refundsProcessed: result.refundsProcessed,
      };
    } catch (error) {
      // Preserve specific exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Error cancelling trip:', error);
      const message = await this.i18n.translate(
        'translation.trip.cancel.failed',
        {
          lang,
          defaultValue: 'Failed to cancel trip',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Update trip status based on departure and arrival dates
  async updateTripStatusByDates(tripId: string): Promise<void> {
    // Fetch the trip
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        departure_date: true,
        arrival_date: true,
        status: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const departureDate = new Date(trip.departure_date);
    departureDate.setHours(0, 0, 0, 0);

    const arrivalDate = trip.arrival_date ? new Date(trip.arrival_date) : null;
    if (arrivalDate) {
      arrivalDate.setHours(0, 0, 0, 0);
    }

    let newStatus: TripStatus | null = null;

    // Check if trip should be COMPLETED (arrival date has passed)
    if (arrivalDate && arrivalDate < today) {
      newStatus = TripStatus.COMPLETED;
    }
    // Check if trip should be INPROGRESS (departed but not yet arrived)
    else if (departureDate <= today && (!arrivalDate || arrivalDate >= today)) {
      newStatus = TripStatus.INPROGRESS;
    }

    // Update status if it needs to change
    if (newStatus && trip.status !== newStatus) {
      await this.prisma.trip.update({
        where: { id: tripId },
        data: { status: newStatus },
      });
    }
  }

  // Get all trips created by user with status filter
  async getUserTrips(
    userId: string,
    query: GetUserTripsQueryDto,
    lang?: string,
  ): Promise<GetUserTripsResponseDto> {
    try {
      const { status, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {
        user_id: userId,
      };

      // Only filter by status if provided and not "ALL"
      if (status && status !== 'ALL') {
        whereClause.status = status;
      }

      // Fetch trips with relations
      // Note: Trip statuses are automatically updated by the scheduler every hour
      const [trips, total] = await Promise.all([
        this.prisma.trip.findMany({
          where: whereClause,
          select: {
            id: true,
            departure: true,
            destination: true,
            status: true,
            departure_date: true,
            departure_time: true,
            arrival_date: true,
            arrival_time: true,
            createdAt: true,
            airline: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            ratings: {
              select: {
                id: true,
                rating: true,
                comment: true,
                giver_id: true,
              },
            },
            transactions: {
              where: {
                status: {
                  in: ['ONHOLD', 'COMPLETED', 'SUCCESS'],
                },
              },
              select: {
                amount_paid: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.trip.count({ where: whereClause }),
      ]);

      // Process trips to calculate average rating and total payment
      const processedTrips = trips.map((trip) => {
        // Calculate average rating
        const ratingsSum = trip.ratings.reduce(
          (sum, rating) => sum + rating.rating,
          0,
        );
        const average_rating =
          trip.ratings.length > 0 ? ratingsSum / trip.ratings.length : 0;

        // Calculate total payment
        const total_payment = trip.transactions.reduce(
          (sum, transaction) => sum + Number(transaction.amount_paid),
          0,
        );

        return {
          id: trip.id,
          departure: trip.departure,
          destination: trip.destination,
          status: trip.status,
          departure_date: trip.departure_date,
          departure_time: trip.departure_time,
          arrival_date: trip.arrival_date,
          arrival_time: trip.arrival_time,
          airline: trip.airline,
          ratings: trip.ratings,
          average_rating: Number(average_rating.toFixed(2)),
          total_payment: Number(total_payment.toFixed(2)),
          createdAt: trip.createdAt,
        };
      });

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.trip.getUserTrips.success',
        {
          lang,
          defaultValue: 'User trips retrieved successfully',
        },
      );

      return {
        message,
        trips: processedTrips,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting user trips:', error);
      const message = await this.i18n.translate(
        'translation.trip.getUserTrips.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve user trips',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Get user trip detail by ID
  async getUserTripDetail(
    userId: string,
    tripId: string,
    lang?: string,
  ): Promise<GetUserTripDetailResponseDto> {
    try {
      // Fetch the trip with all relations
      const trip: any = await this.prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          user_id: true,
          pickup: true,
          departure: true,
          destination: true,
          delivery: true,
          departure_date: true,
          departure_time: true,
          arrival_date: true,
          arrival_time: true,
          currency: true,
          maximum_weight_in_kg: true,
          notes: true,
          meetup_flexible: true,
          status: true,
          fully_booked: true,
          createdAt: true,
          updatedAt: true,
          airline: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          mode_of_transport: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          trip_items: {
            select: {
              trip_item_id: true,
              price: true,
              avalailble_kg: true,
              prices: {
                select: {
                  currency: true,
                  price: true,
                },
              },
              trip_item: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  image: {
                    select: {
                      id: true,
                      url: true,
                      alt_text: true,
                    },
                  },
                },
              },
            },
          },
          requests: {
            select: {
              id: true,
              user_id: true,
              status: true,
              cost: true,
              currency: true,
              message: true,
              created_at: true,
              updated_at: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  picture: true,
                },
              },
              request_items: {
                select: {
                  trip_item_id: true,
                  quantity: true,
                  special_notes: true,
                  trip_item: {
                    select: {
                      id: true,
                      name: true,
                      description: true,
                      image: {
                        select: {
                          id: true,
                          url: true,
                          alt_text: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          transactions: {
            where: {
              status: {
                in: ['SUCCESS', 'COMPLETED', 'ONHOLD'],
              },
            },
            select: {
              amount_paid: true,
              status: true,
            },
          },
        },
      });

      if (!trip) {
        const message = await this.i18n.translate(
          'translation.trip.getUserTripDetail.notFound',
          {
            lang,
            defaultValue: 'Trip not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Check if the trip belongs to the user
      if (trip.user_id !== userId) {
        const message = await this.i18n.translate(
          'translation.trip.getUserTripDetail.unauthorized',
          {
            lang,
            defaultValue: 'You are not authorized to view this trip',
          },
        );
        throw new ForbiddenException(message);
      }

      // Calculate available_earnings (SUCCESS + COMPLETED)
      const available_earnings = trip.transactions
        .filter((t) => t.status === 'SUCCESS' || t.status === 'COMPLETED')
        .reduce((sum, t) => sum + Number(t.amount_paid), 0);

      // Calculate hold_earnings (ONHOLD)
      const hold_earnings = trip.transactions
        .filter((t) => t.status === 'ONHOLD')
        .reduce((sum, t) => sum + Number(t.amount_paid), 0);

      // Transform trip items
      const tripItems = trip.trip_items.map((item) => ({
        trip_item_id: item.trip_item_id,
        price: Number(item.price),
        available_kg: item.avalailble_kg ? Number(item.avalailble_kg) : null,
        prices: item.prices
          ? item.prices.map((p) => ({
              currency: p.currency,
              price: Number(p.price),
            }))
          : [],
        trip_item: item.trip_item,
      }));

      // Transform requests
      const requests = trip.requests.map((request) => ({
        id: request.id,
        user_id: request.user_id,
        status: request.status,
        cost: request.cost ? Number(request.cost) : null,
        currency: request.currency,
        message: request.message,
        created_at: request.created_at,
        updated_at: request.updated_at,
        user: request.user,
        request_items: request.request_items.map((item) => ({
          trip_item_id: item.trip_item_id,
          quantity: item.quantity,
          special_notes: item.special_notes,
          trip_item: item.trip_item,
        })),
      }));

      // Calculate total_kg from trip items
      const total_kg = trip.trip_items.reduce((sum, item) => {
        return sum + (item.avalailble_kg ? Number(item.avalailble_kg) : 0);
      }, 0);

      // Calculate booked_kg from all active request items
      const booked_kg = trip.requests
        .filter(
          (request) =>
            ![
              'CANCELLED',
              'DECLINED',
              'REFUNDED',
              'PENDING',
              'ACCEPTED',
            ].includes(request.status),
        )
        .reduce((sum, request) => {
          const requestKg = request.request_items.reduce((reqSum, item) => {
            return reqSum + item.quantity;
          }, 0);
          return sum + requestKg;
        }, 0);

      // Calculate available_kg
      const available_kg = total_kg - booked_kg;

      const message = await this.i18n.translate(
        'translation.trip.getUserTripDetail.success',
        {
          lang,
          defaultValue: 'Trip details retrieved successfully',
        },
      );

      return {
        message,
        trip: {
          id: trip.id,
          user_id: trip.user_id,
          pickup: trip.pickup,
          departure: trip.departure,
          destination: trip.destination,
          delivery: trip.delivery,
          departure_date: trip.departure_date,
          departure_time: trip.departure_time,
          arrival_date: trip.arrival_date,
          arrival_time: trip.arrival_time,
          currency: trip.currency,
          maximum_weight_in_kg: trip.maximum_weight_in_kg
            ? Number(trip.maximum_weight_in_kg)
            : null,
          notes: trip.notes,
          meetup_flexible: trip.meetup_flexible,
          status: trip.status,
          fully_booked: trip.fully_booked,
          createdAt: trip.createdAt,
          updatedAt: trip.updatedAt,
          airline: trip.airline,
          mode_of_transport: trip.mode_of_transport,
          trip_items: tripItems,
          requests,
          available_earnings: Number(available_earnings.toFixed(2)),
          hold_earnings: Number(hold_earnings.toFixed(2)),
          booked_kg: Number(booked_kg.toFixed(2)),
          available_kg: Number(available_kg.toFixed(2)),
          total_kg: Number(total_kg.toFixed(2)),
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      console.error('Error getting user trip detail:', error);
      const message = await this.i18n.translate(
        'translation.trip.getUserTripDetail.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve trip details',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // TransportType methods
  async createTransportType(
    createTransportTypeDto: CreateTransportTypeDto,
    lang?: string,
  ): Promise<CreateTransportTypeResponseDto> {
    // Check if transport type with this name already exists
    const existingTransportType = await this.prisma.transportType.findUnique({
      where: { name: createTransportTypeDto.name },
    });

    if (existingTransportType) {
      const message = await this.i18n.translate(
        'translation.transportType.create.nameExists',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    try {
      const transportType = await this.prisma.transportType.create({
        data: createTransportTypeDto,
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.transportType.create.success',
        {
          lang,
        },
      );

      return {
        message,
        transportType,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.transportType.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateTransportType(
    transportTypeId: string,
    updateTransportTypeDto: UpdateTransportTypeDto,
    lang?: string,
  ): Promise<UpdateTransportTypeResponseDto> {
    // Check if transport type exists
    const existingTransportType = await this.prisma.transportType.findUnique({
      where: { id: transportTypeId },
    });

    if (!existingTransportType) {
      const message = await this.i18n.translate(
        'translation.transportType.update.notFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Check if name is being updated and if it conflicts with existing name
    if (
      updateTransportTypeDto.name &&
      updateTransportTypeDto.name !== existingTransportType.name
    ) {
      const conflictingTransportType =
        await this.prisma.transportType.findUnique({
          where: { name: updateTransportTypeDto.name },
        });

      if (conflictingTransportType) {
        const message = await this.i18n.translate(
          'translation.transportType.update.nameExists',
          {
            lang,
          },
        );
        throw new ConflictException(message);
      }
    }

    try {
      const transportType = await this.prisma.transportType.update({
        where: { id: transportTypeId },
        data: updateTransportTypeDto,
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.transportType.update.success',
        {
          lang,
        },
      );

      return {
        message,
        transportType,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.transportType.update.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // TripItem methods
  async createTripItem(
    createTripItemDto: CreateTripItemDto,
    lang: string = 'en',
    imageFile?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    },
  ): Promise<CreateTripItemResponseDto> {
    // Check if trip item with this name already exists
    const existingTripItem = await this.prisma.tripItem.findUnique({
      where: { name: createTripItemDto.name },
    });

    if (existingTripItem) {
      const message = await this.i18n.translate(
        'translation.tripItem.create.nameExists',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    try {
      if ('image' in createTripItemDto) {
        delete (createTripItemDto as any).image;
      }

      let translationsArray: Array<{
        language: string;
        name: string;
        description?: string | null;
      }> = [];

      if (createTripItemDto.translations) {
        try {
          const parsed = JSON.parse(createTripItemDto.translations);
          if (!Array.isArray(parsed)) {
            throw new Error('Translations must be an array');
          }
          translationsArray = parsed;
        } catch (error) {
          throw new BadRequestException('Invalid translations JSON format');
        }
      }

      const tripItemId = randomUUID();
      let imageId: string | null = null;

      if (imageFile) {
        const uploadResult = await this.imageService.uploadFile(imageFile, {
          folder: 'trip-items',
          alt_text: createTripItemDto.name,
          object_id: tripItemId,
        });
        imageId = uploadResult.image.id;
      }

      const { translations, ...tripItemData } = createTripItemDto as any;

      // Create trip item with translations in a transaction
      const tripItem = await this.prisma.$transaction(async (prisma) => {
        // Create the trip item
        const createdItem = await prisma.tripItem.create({
          data: {
            id: tripItemId,
            ...tripItemData,
            image_id: imageId,
          } as any,
        });

        // Create translations if provided
        if (translationsArray.length > 0) {
          await prisma.translation.createMany({
            data: translationsArray.map((translation) => ({
              trip_item_id: createdItem.id,
              language: translation.language as Language,
              name: translation.name,
              description: translation.description || null,
            })),
          });
        }

        // Fetch the created item with translations
        return prisma.tripItem.findUnique({
          where: { id: createdItem.id },
          select: {
            id: true,
            name: true,
            description: true,
            image: {
              select: {
                id: true,
                url: true,
                alt_text: true,
              },
            },
            translations: {
              select: {
                id: true,
                language: true,
                name: true,
                description: true,
              },
            },
          },
        });
      });

      const message = await this.i18n.translate(
        'translation.tripItem.create.success',
        {
          lang,
        },
      );

      return {
        message,
        tripItem,
      };
    } catch (error) {
      console.log(error);
      const message = await this.i18n.translate(
        'translation.tripItem.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateTripItem(
    tripItemId: string,
    updateTripItemDto: UpdateTripItemDto,
    lang: string = 'en',
  ): Promise<UpdateTripItemResponseDto> {
    // Check if trip item exists
    const existingTripItem = await this.prisma.tripItem.findUnique({
      where: { id: tripItemId },
    });

    if (!existingTripItem) {
      const message = await this.i18n.translate(
        'translation.tripItem.update.notFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Check if name is being updated and if it conflicts with existing name
    if (
      updateTripItemDto.name &&
      updateTripItemDto.name !== existingTripItem.name
    ) {
      const conflictingTripItem = await this.prisma.tripItem.findUnique({
        where: { name: updateTripItemDto.name },
      });

      if (conflictingTripItem) {
        const message = await this.i18n.translate(
          'translation.tripItem.update.nameExists',
          {
            lang,
          },
        );
        throw new ConflictException(message);
      }
    }

    try {
      if ('image' in updateTripItemDto) {
        delete (updateTripItemDto as any).image;
      }

      let translationsArray:
        | Array<{
            language: string;
            name: string;
            description?: string | null;
          }>
        | undefined = undefined;

      if (updateTripItemDto.translations !== undefined) {
        if (updateTripItemDto.translations === null) {
          translationsArray = [];
        } else if (typeof updateTripItemDto.translations === 'string') {
          try {
            const parsed = JSON.parse(updateTripItemDto.translations);
            if (!Array.isArray(parsed)) {
              throw new Error('Translations must be an array');
            }
            translationsArray = parsed;
          } catch (error) {
            throw new BadRequestException('Invalid translations JSON format');
          }
        }
      }

      const { translations, ...tripItemData } = updateTripItemDto as any;

      // Update trip item and translations in a transaction
      const tripItem = await this.prisma.$transaction(async (prisma) => {
        // Update the trip item
        await prisma.tripItem.update({
          where: { id: tripItemId },
          data: {
            ...tripItemData,
            image_id:
              updateTripItemDto.image_id !== undefined
                ? updateTripItemDto.image_id
                : undefined,
          } as any,
        });

        // Handle translations if provided
        if (translationsArray !== undefined) {
          // Delete existing translations
          await prisma.translation.deleteMany({
            where: { trip_item_id: tripItemId },
          });

          // Create new translations
          if (translationsArray.length > 0) {
            await prisma.translation.createMany({
              data: translationsArray.map((translation) => ({
                trip_item_id: tripItemId,
                language: translation.language as Language,
                name: translation.name,
                description: translation.description || null,
              })),
            });
          }
        }

        // Fetch the updated item with translations
        return prisma.tripItem.findUnique({
          where: { id: tripItemId },
          select: {
            id: true,
            name: true,
            description: true,
            image: {
              select: {
                id: true,
                url: true,
                alt_text: true,
              },
            },
            translations: {
              select: {
                id: true,
                language: true,
                name: true,
                description: true,
              },
            },
          },
        });
      });

      const message = await this.i18n.translate(
        'translation.tripItem.update.success',
        {
          lang,
        },
      );

      return {
        message,
        tripItem,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.tripItem.update.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Add translation to trip item
  async addTripItemTranslation(
    tripItemId: string,
    translation: {
      language: 'en' | 'fr';
      name: string;
      description?: string;
    },
    lang?: string,
  ) {
    // Check if trip item exists
    const existingTripItem = await this.prisma.tripItem.findUnique({
      where: { id: tripItemId },
    });

    if (!existingTripItem) {
      const message = await this.i18n.translate(
        'translation.tripItem.translation.notFound',
        {
          lang,
          defaultValue: 'Trip item not found',
        },
      );
      throw new NotFoundException(message);
    }

    try {
      // Check if translation for this language already exists
      const existingTranslation = await this.prisma.translation.findFirst({
        where: {
          trip_item_id: tripItemId,
          language: translation.language,
        },
      });

      let updatedTripItem;

      if (existingTranslation) {
        // Update existing translation
        await this.prisma.translation.update({
          where: { id: existingTranslation.id },
          data: {
            name: translation.name,
            description: translation.description || null,
          },
        });
      } else {
        // Create new translation
        await this.prisma.translation.create({
          data: {
            trip_item_id: tripItemId,
            language: translation.language as Language,
            name: translation.name,
            description: translation.description || null,
          },
        });
      }

      // Fetch the updated trip item with all translations
      updatedTripItem = await this.prisma.tripItem.findUnique({
        where: { id: tripItemId },
        select: {
          id: true,
          name: true,
          description: true,
          translations: {
            select: {
              id: true,
              language: true,
              name: true,
              description: true,
            },
          },
        },
      });

      const message = await this.i18n.translate(
        'translation.tripItem.translation.success',
        {
          lang,
          defaultValue: 'Translation added successfully',
        },
      );

      return {
        message,
        tripItem: updatedTripItem,
      };
    } catch (error) {
      console.error('Error adding translation:', error);
      const message = await this.i18n.translate(
        'translation.tripItem.translation.failed',
        {
          lang,
          defaultValue: 'Failed to add translation',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // GET methods for TransportType
  async getAllTransportTypes(
    query: GetTransportTypesQueryDto,
    lang?: string,
  ): Promise<GetTransportTypesResponseDto> {
    try {
      const { page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const [transportTypes, total] = await Promise.all([
        this.prisma.transportType.findMany({
          select: {
            id: true,
            name: true,
            description: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.transportType.count(),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      const message = await this.i18n.translate(
        'translation.transportType.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        transportTypes,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.transportType.getAll.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getTransportTypeById(transportTypeId: string, lang?: string) {
    try {
      const transportType = await this.prisma.transportType.findUnique({
        where: { id: transportTypeId },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      if (!transportType) {
        const message = await this.i18n.translate(
          'translation.transportType.getById.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      const message = await this.i18n.translate(
        'translation.transportType.getById.success',
        {
          lang,
        },
      );

      return {
        message,
        transportType,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.transportType.getById.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // GET methods for TripItem
  async getAllTripItems(
    query: GetTripItemsQueryDto,
    lang?: string,
  ): Promise<GetTripItemsResponseDto> {
    try {
      const { page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const [tripItems, total] = await Promise.all([
        this.prisma.tripItem.findMany({
          select: {
            id: true,
            name: true,
            description: true,
            image: {
              select: {
                id: true,
                url: true,
                alt_text: true,
              },
            },
            translations: {
              select: {
                id: true,
                language: true,
                name: true,
                description: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.tripItem.count(),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      const message = await this.i18n.translate(
        'translation.tripItem.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        tripItems,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.tripItem.getAll.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getTripItemById(tripItemId: string, lang?: string) {
    try {
      const tripItem = await this.prisma.tripItem.findUnique({
        where: { id: tripItemId },
        select: {
          id: true,
          name: true,
          description: true,
          image: {
            select: {
              id: true,
              url: true,
              alt_text: true,
            },
          },
          translations: {
            select: {
              id: true,
              language: true,
              name: true,
              description: true,
            },
          },
        },
      });

      if (!tripItem) {
        const message = await this.i18n.translate(
          'translation.tripItem.getById.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      const message = await this.i18n.translate(
        'translation.tripItem.getById.success',
        {
          lang,
        },
      );

      return {
        message,
        tripItem,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.tripItem.getById.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Get trips with pagination and country filtering
  async getTrips(
    query: GetTripsQueryDto,
    userId?: string,
    lang?: string,
  ): Promise<GetTripsResponseDto> {
    try {
      const {
        country,
        departure,
        destination,
        filter = 'all',
        page = 1,
        limit = 10,
        trip_items_ids,
        departure_date_from,
        departure_date_to,
      } = query;
      const skip = (page - 1) * limit;

      // Base where clause - exclude DRAFT, COMPLETED, and CANCELLED trips
      const baseWhereClause: any = {
        status: {
          notIn: [TripStatus.DRAFT, TripStatus.COMPLETED, TripStatus.CANCELLED],
        },
      };

      // Add departure date filter based on filter parameter
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Handle custom date range if provided
      if (departure_date_from || departure_date_to) {
        const dateFilter: any = {};

        if (departure_date_from) {
          const fromDate = new Date(departure_date_from);
          dateFilter.gte = fromDate;
        }

        if (departure_date_to) {
          const toDate = new Date(departure_date_to);
          dateFilter.lte = toDate;
        }

        baseWhereClause.departure_date = dateFilter;
      } else if (filter === 'today') {
        // Show only trips departing today
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        baseWhereClause.departure_date = {
          gte: today,
          lt: tomorrow,
        };
      } else if (filter === 'tomorrow') {
        // Show only trips departing tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        baseWhereClause.departure_date = {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        };
      } else if (filter === 'week') {
        // Show only trips departing this week (from today to end of week - Sunday)
        const endOfWeek = new Date(today);
        const dayOfWeek = today.getDay();
        const daysUntilSunday = 7 - dayOfWeek;
        endOfWeek.setDate(today.getDate() + daysUntilSunday);
        endOfWeek.setHours(23, 59, 59, 999);

        baseWhereClause.departure_date = {
          gte: today,
          lte: endOfWeek,
        };
      } else {
        // filter === 'all': Show all future trips
        baseWhereClause.departure_date = {
          gte: today, // Only show trips with departure date >= today
        };
      }

      // Add search filters if departure or destination is provided
      if (
        (departure && departure.trim() !== '') ||
        (destination && destination.trim() !== '')
      ) {
        try {
          // If both departure and destination are provided, prioritize exact city matches
          if (
            departure &&
            departure.trim() !== '' &&
            destination &&
            destination.trim() !== ''
          ) {
            // First, try to match exact cities (region/city/address) for both departure and destination
            // This will be handled in post-processing to prioritize exact matches
            // For now, we'll search by country to get all matching trips
            baseWhereClause.AND = [
              {
                departure: {
                  path: ['country'],
                  string_contains: departure.trim(),
                  mode: 'insensitive',
                },
              },
              {
                destination: {
                  path: ['country'],
                  string_contains: destination.trim(),
                  mode: 'insensitive',
                },
              },
            ];
          } else {
            // If only one is provided, use OR conditions for flexible search
            const searchFilters = [];

            // Search in departure location if departure parameter is provided
            if (departure && departure.trim() !== '') {
              searchFilters.push({
                departure: {
                  path: ['country'],
                  string_contains: departure.trim(),
                  mode: 'insensitive',
                },
              });

              searchFilters.push({
                departure: {
                  path: ['region'],
                  string_contains: departure.trim(),
                  mode: 'insensitive',
                },
              });

              searchFilters.push({
                departure: {
                  path: ['address'],
                  string_contains: departure.trim(),
                  mode: 'insensitive',
                },
              });
            }

            // Search in destination location if destination parameter is provided
            if (destination && destination.trim() !== '') {
              searchFilters.push({
                destination: {
                  path: ['country'],
                  string_contains: destination.trim(),
                  mode: 'insensitive',
                },
              });

              searchFilters.push({
                destination: {
                  path: ['region'],
                  string_contains: destination.trim(),
                  mode: 'insensitive',
                },
              });

              searchFilters.push({
                destination: {
                  path: ['address'],
                  string_contains: destination.trim(),
                  mode: 'insensitive',
                },
              });
            }

            // Add OR condition for all search filters
            baseWhereClause.OR = searchFilters;
          }
        } catch (error) {
          // If search filter creation fails, log error but continue without search
          console.error('Error creating search filters:', error);
        }
      }

      // Add trip items filtering if trip_items_ids is provided
      // After Transform, trip_items_ids is always an array (or undefined)
      if (
        trip_items_ids &&
        Array.isArray(trip_items_ids) &&
        trip_items_ids.length > 0
      ) {
        try {
          // Filter trips that have at least one of the specified trip items
          baseWhereClause.trip_items = {
            some: {
              trip_item_id: {
                in: trip_items_ids,
              },
            },
          };
        } catch (error) {
          // If trip items filter creation fails, log error but continue without filter
          console.error('Error creating trip items filter:', error);
        }
      }

      // If both departure and destination are provided, we need to fetch all trips first
      // to properly prioritize exact city matches, then apply pagination
      const shouldFetchAllForSorting =
        departure &&
        departure.trim() !== '' &&
        destination &&
        destination.trim() !== '';

      // Get trips - fetch all if we need to sort by exact matches, otherwise use pagination
      const [allTrips, total] = await Promise.all([
        this.prisma.trip.findMany({
          where: baseWhereClause,
          select: {
            id: true,
            departure_date: true,
            departure_time: true,
            arrival_date: true,
            arrival_time: true,
            currency: true,
            departure: true,
            destination: true,
            createdAt: true,
            mode_of_transport: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                isFreightForwarder: true,
                picture: true,
                kycRecords: {
                  select: {
                    id: true,
                    status: true,
                    provider: true,
                    rejectionReason: true,
                    createdAt: true,
                    updatedAt: true,
                    verifiedAt: true,
                    expiresAt: true,
                  },
                  orderBy: {
                    createdAt: 'desc',
                  },
                  take: 1, // Get the most recent KYC record
                },
              },
            },
            trip_items: {
              select: {
                trip_item_id: true,
                price: true,
                avalailble_kg: true,
                prices: {
                  select: {
                    currency: true,
                    price: true,
                  },
                },
                trip_item: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    image: {
                      select: {
                        id: true,
                        url: true,
                        alt_text: true,
                      },
                    },
                    translations: {
                      select: {
                        id: true,
                        language: true,
                        name: true,
                        description: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          ...(shouldFetchAllForSorting ? {} : { skip, take: limit }),
        }),
        this.prisma.trip.count({ where: baseWhereClause }),
      ]);

      let trips: any[] = allTrips;

      // If both departure and destination are provided, prioritize exact city matches
      if (
        departure &&
        departure.trim() !== '' &&
        destination &&
        destination.trim() !== ''
      ) {
        const departureLower = departure.trim().toLowerCase();
        const destinationLower = destination.trim().toLowerCase();

        // Separate trips into exact city matches and country-only matches
        const exactCityMatches: any[] = [];
        const countryOnlyMatches: any[] = [];

        allTrips.forEach((trip) => {
          const tripDeparture = trip.departure as any;
          const tripDestination = trip.destination as any;

          // Check if departure city matches (region, city, or address)
          // First check for exact matches, then for contains matches
          const departureMatches =
            tripDeparture &&
            typeof tripDeparture === 'object' &&
            (departureLower === (tripDeparture.region || '').toLowerCase() ||
              departureLower === (tripDeparture.city || '').toLowerCase() ||
              departureLower === (tripDeparture.address || '').toLowerCase() ||
              (tripDeparture.city || '')
                .toLowerCase()
                .includes(departureLower) ||
              (tripDeparture.address || '')
                .toLowerCase()
                .includes(departureLower) ||
              (tripDeparture.region || '')
                .toLowerCase()
                .includes(departureLower));

          // Check if destination city matches (region, city, or address)
          // First check for exact matches, then for contains matches
          const destinationMatches =
            tripDestination &&
            typeof tripDestination === 'object' &&
            (destinationLower ===
              (tripDestination.region || '').toLowerCase() ||
              destinationLower === (tripDestination.city || '').toLowerCase() ||
              destinationLower ===
                (tripDestination.address || '').toLowerCase() ||
              (tripDestination.city || '')
                .toLowerCase()
                .includes(destinationLower) ||
              (tripDestination.address || '')
                .toLowerCase()
                .includes(destinationLower) ||
              (tripDestination.region || '')
                .toLowerCase()
                .includes(destinationLower));

          if (departureMatches && destinationMatches) {
            // Exact city match for both departure and destination
            exactCityMatches.push(trip);
          } else {
            // Country match only (already filtered by country in the query)
            countryOnlyMatches.push(trip);
          }
        });

        // Sort both groups chronologically by departure_date
        exactCityMatches.sort((a, b) => {
          const dateA = new Date(a.departure_date).getTime();
          const dateB = new Date(b.departure_date).getTime();
          return dateA - dateB;
        });

        countryOnlyMatches.sort((a, b) => {
          const dateA = new Date(a.departure_date).getTime();
          const dateB = new Date(b.departure_date).getTime();
          return dateA - dateB;
        });

        // Combine: exact city matches first, then country-only matches
        trips = [...exactCityMatches, ...countryOnlyMatches];

        // Apply pagination after sorting
        const startIndex = skip;
        const endIndex = skip + limit;
        trips = trips.slice(startIndex, endIndex);
      } else if (
        country &&
        (!departure || departure.trim() === '') &&
        (!destination || destination.trim() === '')
      ) {
        // If country is specified and no departure/destination search, reorder to put matching trips at the top
        const countryTrips = allTrips.filter((trip) => {
          const destinationCountry =
            trip.destination &&
            typeof trip.destination === 'object' &&
            'country_code' in trip.destination
              ? (trip.destination as any).country_code
              : null;

          return destinationCountry?.toLowerCase() === country.toLowerCase();
        });

        const otherTrips = allTrips.filter((trip) => {
          const destinationCountry =
            trip.destination &&
            typeof trip.destination === 'object' &&
            'country_code' in trip.destination
              ? (trip.destination as any).country_code
              : null;

          return destinationCountry?.toLowerCase() !== country.toLowerCase();
        });

        // Put country-specific trips at the top, then other trips
        trips = [...countryTrips, ...otherTrips];
      }

      // Fetch chat info for all trips where user is a member (when userId provided)
      const chatInfoMap = new Map<
        string,
        { id: string; name: string | null; createdAt: Date }
      >();
      if (userId) {
        const tripIds = trips.map((trip) => trip.id);
        if (tripIds.length > 0) {
          const userChats = await this.prisma.chat.findMany({
            where: {
              trip_id: {
                in: tripIds,
              },
              members: {
                some: {
                  user_id: userId,
                },
              },
            },
            select: {
              id: true,
              name: true,
              createdAt: true,
              trip_id: true,
            },
          });

          userChats.forEach((chat) => {
            if (chat.trip_id) {
              chatInfoMap.set(chat.trip_id, {
                id: chat.id,
                name: chat.name,
                createdAt: chat.createdAt,
              });
            }
          });
        }
      }

      // Transform trips to summary format
      const tripSummaries = trips.map((trip) => ({
        id: trip.id,
        user: trip.user
          ? {
              id: trip.user.id,
              email: trip.user.email,
              role: trip.user.role,
              isFreightForwarder: trip.user.isFreightForwarder,
              picture: trip.user.picture,
              kycRecords: trip.user.kycRecords || [],
            }
          : null,
        departure_date: trip.departure_date,
        departure_time: trip.departure_time,
        arrival_date: trip.arrival_date,
        arrival_time: trip.arrival_time,
        currency: trip.currency,
        mode_of_transport: trip.mode_of_transport
          ? {
              id: trip.mode_of_transport.id,
              name: trip.mode_of_transport.name,
              description: trip.mode_of_transport.description,
            }
          : null,
        departure: trip.departure,
        destination: trip.destination,
        from: trip.departure, // Alias for departure
        to: trip.destination, // Alias for destination
        trip_items: trip.trip_items.map((item) => ({
          trip_item_id: item.trip_item_id,
          price: Number(item.price),
          available_kg: item.avalailble_kg ? Number(item.avalailble_kg) : null,
          prices: item.prices
            ? item.prices.map((p) => ({
                currency: p.currency,
                price: Number(p.price),
              }))
            : [],
          trip_item: item.trip_item,
        })),
        createdAt: trip.createdAt,
        chat_info: chatInfoMap.get(trip.id) || null,
      }));

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.trip.getAll.success',
        { lang },
      );
      return {
        message,
        trips: tripSummaries,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error('Error getting trips:', error);
      const message = await this.i18n.translate(
        'translation.trip.getAll.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Get trip by ID with full details
  async getTripById(
    tripId: string,
    userId: string,
    lang?: string,
  ): Promise<GetTripByIdResponseDto> {
    try {
      const trip = await this.prisma.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          user_id: true,
          pickup: true,
          departure: true,
          destination: true,
          delivery: true,
          departure_date: true,
          departure_time: true,
          arrival_date: true,
          arrival_time: true,
          currency: true,
          mode_of_transport_id: true,
          airline_id: true,
          maximum_weight_in_kg: true,
          notes: true,
          meetup_flexible: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              picture: true,
              role: true,
            },
          },
          mode_of_transport: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          airline: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          trip_items: {
            select: {
              trip_item_id: true,
              price: true,
              avalailble_kg: true,
              prices: {
                select: {
                  currency: true,
                  price: true,
                },
              },
              trip_item: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  image: {
                    select: {
                      id: true,
                      url: true,
                      alt_text: true,
                    },
                  },
                  translations: {
                    select: {
                      id: true,
                      language: true,
                      name: true,
                      description: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!trip) {
        const message = await this.i18n.translate(
          'translation.trip.getById.notFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Transform trip items
      const tripItems = trip.trip_items.map((item) => ({
        trip_item_id: item.trip_item_id,
        price: Number(item.price),
        available_kg: item.avalailble_kg ? Number(item.avalailble_kg) : null,
        prices: item.prices
          ? item.prices.map((p) => ({
              currency: p.currency,
              price: Number(p.price),
            }))
          : [],
        trip_item: {
          ...item.trip_item,
          translations: item.trip_item.translations || [],
        },
      }));

      // Calculate total_kg from trip items
      const total_kg = trip.trip_items.reduce((sum, item) => {
        return sum + (item.avalailble_kg ? Number(item.avalailble_kg) : 0);
      }, 0);

      // Get all requests for this trip and calculate booked_kg
      const requests = await this.prisma.tripRequest.findMany({
        where: {
          trip_id: tripId,
          status: {
            notIn: ['CANCELLED', 'DECLINED', 'REFUNDED', 'PENDING'],
          },
        },
        include: {
          request_items: {
            select: {
              quantity: true,
            },
          },
        },
      });

      // Calculate booked_kg from all request items
      const booked_kg = requests.reduce((sum, request) => {
        const requestKg = request.request_items.reduce((reqSum, item) => {
          return reqSum + item.quantity;
        }, 0);
        return sum + requestKg;
      }, 0);

      // Calculate available_kg
      const available_kg = total_kg - booked_kg;

      // Fetch chat info if user is a member of a chat for this trip
      const userChat = await this.prisma.chat.findFirst({
        where: {
          trip_id: tripId,
          members: {
            some: {
              user_id: userId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      const chat_info = userChat
        ? {
            id: userChat.id,
            name: userChat.name,
            createdAt: userChat.createdAt,
          }
        : null;

      const message = await this.i18n.translate(
        'translation.trip.getById.success',
        { lang },
      );
      return {
        message,
        trip: {
          id: trip.id,
          user_id: trip.user_id,
          user: trip.user,
          pickup: trip.pickup,
          departure: trip.departure,
          destination: trip.destination,
          delivery: trip.delivery,
          departure_date: trip.departure_date,
          departure_time: trip.departure_time,
          arrival_date: trip.arrival_date,
          arrival_time: trip.arrival_time,
          currency: trip.currency,
          mode_of_transport_id: trip.mode_of_transport_id,
          airline_id: trip.airline_id,
          maximum_weight_in_kg: trip.maximum_weight_in_kg
            ? Number(trip.maximum_weight_in_kg)
            : null,
          notes: trip.notes,
          meetup_flexible: trip.meetup_flexible,
          status: trip.status,
          createdAt: trip.createdAt,
          updatedAt: trip.updatedAt,
          mode_of_transport: trip.mode_of_transport,
          airline: trip.airline,
          trip_items: tripItems,
          booked_kg: Number(booked_kg.toFixed(2)),
          available_kg: Number(available_kg.toFixed(2)),
          total_kg: Number(total_kg.toFixed(2)),
          chat_info: chat_info || undefined,
        } as any,
      };
    } catch (error) {
      console.error('Error getting trip item by id:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.trip.getById.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Airline methods
  async createAirline(
    createAirlineDto: CreateAirlineDto,
    lang?: string,
  ): Promise<CreateAirlineResponseDto> {
    // Check if airline with this name already exists
    const existingAirline = await this.prisma.airline.findUnique({
      where: { name: createAirlineDto.name },
    });

    if (existingAirline) {
      const message = await this.i18n.translate(
        'translation.airline.create.nameExists',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    try {
      const airline = await this.prisma.airline.create({
        data: createAirlineDto,
        select: {
          id: true,
          name: true,
          description: true,
          created_at: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.airline.create.success',
        {
          lang,
        },
      );

      return {
        message,
        airline,
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.airline.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getAllAirlines(
    query: GetAirlinesQueryDto,
    lang?: string,
  ): Promise<GetAirlinesResponseDto> {
    try {
      const { page = 1, limit = 10, searchKey } = query;
      const skip = (page - 1) * limit;

      // Build where clause for search
      const whereClause: any = {};
      if (searchKey && searchKey.trim() !== '') {
        whereClause.name = {
          contains: searchKey,
          mode: 'insensitive',
        };
      }

      const [airlines, total] = await Promise.all([
        this.prisma.airline.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            description: true,
            created_at: true,
          },
          orderBy: {
            name: 'asc',
          },
          skip,
          take: limit,
        }),
        this.prisma.airline.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      const message = await this.i18n.translate(
        'translation.airline.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        airlines,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.airline.getAll.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  // Alert methods
  async createAlert(
    userId: string,
    createAlertDto: CreateAlertDto,
    lang: string,
  ): Promise<CreateAlertResponseDto> {
    try {
      // Check for existing alert with the same data
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          user_id: userId,
          depature: createAlertDto.depature,
          destination: createAlertDto.destination,
          form_date: createAlertDto.form_date
            ? new Date(createAlertDto.form_date)
            : null,
          to_date: createAlertDto.to_date
            ? new Date(createAlertDto.to_date)
            : null,
        },
      });

      if (existingAlert) {
        const message = await this.i18n.translate(
          'translation.alert.create.duplicate',
          {
            lang,
            defaultValue: 'An alert with the same details already exists',
          },
        );
        throw new ConflictException(message);
      }

      const alert = await this.prisma.alert.create({
        data: {
          user_id: userId,
          depature: createAlertDto.depature,
          destination: createAlertDto.destination,
          notificaction: createAlertDto.notificaction ?? true,
          form_date: createAlertDto.form_date
            ? new Date(createAlertDto.form_date)
            : null,
          to_date: createAlertDto.to_date
            ? new Date(createAlertDto.to_date)
            : null,
        },
      });

      const message = await this.i18n.translate(
        'translation.alert.create.success',
        {
          lang,
        },
      );

      return {
        message,
        alert,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.alert.create.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateAlert(
    alertId: string,
    userId: string,
    updateAlertDto: UpdateAlertDto,
    lang: string,
  ): Promise<UpdateAlertResponseDto> {
    try {
      // Check if alert exists and belongs to user
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          id: alertId,
          user_id: userId,
        },
      });

      if (!existingAlert) {
        const message = await this.i18n.translate(
          'translation.alert.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      const updateData: any = {};
      if (updateAlertDto.depature !== undefined) {
        updateData.depature = updateAlertDto.depature;
      }
      if (updateAlertDto.destination !== undefined) {
        updateData.destination = updateAlertDto.destination;
      }
      if (updateAlertDto.notificaction !== undefined) {
        updateData.notificaction = updateAlertDto.notificaction;
      }
      if (updateAlertDto.form_date !== undefined) {
        updateData.form_date = updateAlertDto.form_date
          ? new Date(updateAlertDto.form_date)
          : null;
      }
      if (updateAlertDto.to_date !== undefined) {
        updateData.to_date = updateAlertDto.to_date
          ? new Date(updateAlertDto.to_date)
          : null;
      }

      const alert = await this.prisma.alert.update({
        where: {
          id: alertId,
        },
        data: updateData,
      });

      const message = await this.i18n.translate(
        'translation.alert.update.success',
        {
          lang,
        },
      );

      return {
        message,
        alert,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.alert.update.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async deleteAlert(
    alertId: string,
    userId: string,
    lang: string,
  ): Promise<DeleteAlertResponseDto> {
    try {
      // Check if alert exists and belongs to user
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          id: alertId,
          user_id: userId,
        },
      });

      if (!existingAlert) {
        const message = await this.i18n.translate(
          'translation.alert.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      await this.prisma.alert.delete({
        where: {
          id: alertId,
        },
      });

      const message = await this.i18n.translate(
        'translation.alert.delete.success',
        {
          lang,
        },
      );

      return {
        message,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.alert.delete.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getUserAlerts(
    userId: string,
    query: GetAlertsQueryDto,
    lang: string,
  ): Promise<GetAlertsResponseDto> {
    try {
      const { page = 1, limit = 10, searchKey } = query;
      const skip = (page - 1) * limit;

      // Build where clause with search functionality
      const whereClause: any = {
        user_id: userId,
      };

      if (searchKey) {
        whereClause.OR = [
          {
            depature: {
              contains: searchKey,
              mode: 'insensitive',
            },
          },
          {
            destination: {
              contains: searchKey,
              mode: 'insensitive',
            },
          },
        ];
      }

      const [alerts, total] = await Promise.all([
        this.prisma.alert.findMany({
          where: whereClause,
          select: {
            id: true,
            user_id: true,
            depature: true,
            destination: true,
            notificaction: true,
            form_date: true,
            to_date: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: {
            created_at: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.alert.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.alert.getAll.success',
        {
          lang,
        },
      );

      return {
        message,
        alerts,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.alert.getAll.failed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Send push notifications to all app users when a new trip is created
   * This method is non-blocking and should be called without await
   */
  private async sendNewTripNotificationToAllUsers(
    trip: any,
    tripData: any,
  ): Promise<void> {
    try {
      // Get all users with device_id (users who have the app installed)
      const users = await this.prisma.user.findMany({
        where: {
          device_id: {
            not: null,
          },
          role: {
            not: UserRole.ADMIN, // Exclude admins
          },
        },
        select: {
          id: true,
          device_id: true,
          lang: true,
        },
      });

      if (users.length === 0) {
        return;
      }

      // Extract departure and destination locations for notification
      const departureLocation =
        (tripData.departure as any)?.city ||
        (tripData.departure as any)?.country ||
        (tripData.departure as any)?.address ||
        'Unknown';
      const destinationLocation =
        (tripData.destination as any)?.city ||
        (tripData.destination as any)?.country ||
        (tripData.destination as any)?.address ||
        'Unknown';

      // Send push notification to each user in their language
      for (const user of users) {
        try {
          if (!user.device_id) continue;

          // Normalize user language to ensure it matches i18n format (lowercase)
          const userLang = user.lang ? user.lang.toLowerCase().trim() : 'en';
          // Ensure it's a valid language ('en' or 'fr'), default to 'en'
          const normalizedUserLang = userLang === 'fr' ? 'fr' : 'en';

          // Translate notification title and body to user's language
          const notificationTitle = await this.i18n.translate(
            'translation.trip.create.newTripNotification.title',
            {
              lang: normalizedUserLang,
              defaultValue: 'New Trip Available',
            },
          );

          const notificationBody = await this.i18n.translate(
            'translation.trip.create.newTripNotification.body',
            {
              lang: normalizedUserLang,
              defaultValue: `A new trip from ${departureLocation} to ${destinationLocation} is now available`,
              args: {
                departure: departureLocation,
                destination: destinationLocation,
              },
            },
          );

          // Send push notification with user's language
          await this.notificationService.sendPushNotification(
            {
              deviceId: user.device_id,
              title: notificationTitle,
              body: notificationBody,
              data: {
                tripId: trip.id,
                type: 'NEW_TRIP',
              },
            },
            normalizedUserLang,
          );
        } catch (error) {
          // Log error but continue with other users
          console.error(
            `Failed to send push notification to user ${user.id}:`,
            error,
          );
        }
      }
    } catch (error) {
      // Log error but don't fail the trip creation
      console.error('Failed to send new trip notifications:', error);
    }
  }
}
