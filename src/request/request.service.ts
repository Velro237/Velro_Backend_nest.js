import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationService } from '../notification/notification.service';
import {
  MessageType as PrismaMessageType,
  UserRole,
  Currency,
  NotificationType,
  RequestStatus,
} from 'generated/prisma';
import { MessageType } from '../chat/dto/send-message.dto';
import {
  CreateTripRequestDto,
  CreateTripRequestResponseDto,
} from './dto/create-trip-request.dto';
import {
  GetTripRequestsQueryDto,
  GetTripRequestsResponseDto,
} from './dto/get-trip-requests.dto';
import {
  UpdateTripRequestDto,
  UpdateTripRequestResponseDto,
} from './dto/update-trip-request.dto';
import {
  AdminEditRequestDto,
  AdminEditRequestResponseDto,
} from './dto/admin-edit-request.dto';
import { AdminDeleteRequestResponseDto } from './dto/admin-delete-request.dto';
import { GetRequestByIdResponseDto } from './dto/get-request-by-id.dto';
import { ConfirmDeliveryResponseDto } from './dto/confirm-delivery.dto';
import {
  CancelRequestDto,
  CancelRequestResponseDto,
} from './dto/cancel-request.dto';
import { RateRequestDto, RateRequestResponseDto } from './dto/rate-request.dto';
import {
  AdminRequestStatisticsQueryDto,
  AdminRequestStatisticsResponseDto,
} from './dto/admin-request-statistics.dto';
import { AdminGetRequestByIdResponseDto } from './dto/admin-get-request-by-id.dto';
import { CancellationService } from './cancellation.service';
import { CurrencyService } from '../currency/currency.service';

@Injectable()
export class RequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly redis: RedisService,
    private readonly walletService: WalletService,
    private readonly notificationService: NotificationService,
    private readonly cancellationService: CancellationService,
    private readonly currencyService: CurrencyService,
  ) {}

  // Trip Request methods
  async createTripRequest(
    createTripRequestDto: CreateTripRequestDto,
    userId: string,
    lang?: string,
  ): Promise<CreateTripRequestResponseDto> {
    const { trip_id, request_items, images, ...requestData } =
      createTripRequestDto;

    // Check if trip exists
    const trip = await this.prisma.trip.findUnique({
      where: { id: trip_id },
      select: {
        id: true,
        user_id: true,
        fully_booked: true,
        currency: true,
        pickup: true,
        destination: true,
        trip_items: {
          include: {
            trip_item: true,
            prices: {
              select: {
                currency: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      const message = await this.i18n.translate(
        'translation.trip.request.tripNotFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Check if trip is fully booked
    if (trip.fully_booked) {
      const message = await this.i18n.translate(
        'translation.trip.request.tripFullyBooked',
        {
          lang,
          defaultValue:
            'This trip is fully booked and not accepting new requests',
        },
      );
      throw new ConflictException(message);
    }

    // Check if user exists and get their currency
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        currency: true,
      },
    });

    if (!user) {
      const message = await this.i18n.translate(
        'translation.trip.request.userNotFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    // Get user's currency (default to XAF if not set)
    const userCurrency = (user.currency || 'XAF').toUpperCase() as Currency;

    // Admins cannot create trip requests
    if (user.role === UserRole.ADMIN) {
      const message = await this.i18n.translate(
        'translation.trip.request.adminCannotCreate',
        {
          lang,
          defaultValue: 'Admins are not allowed to create trip requests',
        },
      );
      throw new ForbiddenException(message);
    }

    // Check if user is not the trip owner
    if (trip.user_id === userId) {
      const message = await this.i18n.translate(
        'translation.trip.request.cannotRequestOwnTrip',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    // Check if a request already exists between this user and this trip
    // Block duplicates only while an active lifecycle request is in progress
    const existingRequest = await this.prisma.tripRequest.findFirst({
      where: {
        trip_id: trip_id,
        user_id: userId,
        is_deleted: false, // Exclude deleted requests when checking for duplicates
        status: {
          in: [
            RequestStatus.PENDING,
            RequestStatus.ACCEPTED,
            RequestStatus.CONFIRMED,
            RequestStatus.SENT,
            RequestStatus.RECEIVED,
            RequestStatus.IN_TRANSIT,
            RequestStatus.PENDING_DELIVERY,
          ],
        },
      },
    });

    if (existingRequest) {
      const message = await this.i18n.translate(
        'translation.trip.request.alreadyExists',
        {
          lang,
          defaultValue:
            'You already have an active request for this trip. Please wait for a response or cancel your existing request before creating a new one.',
        },
      );
      throw new ConflictException(message);
    }

    // Validate request items are provided (all trips now require trip items)
    if (!request_items || request_items.length === 0) {
      const message = await this.i18n.translate(
        'translation.trip.request.itemsRequired',
        {
          lang,
        },
      );
      throw new ConflictException(message);
    }

    // Validate trip items exist and are available in the trip
    const tripItemIds = trip.trip_items.map((item) => item.trip_item_id);
    const requestedItemIds = request_items.map((item) => item.trip_item_id);

    for (const itemId of requestedItemIds) {
      if (!tripItemIds.includes(itemId)) {
        const message = await this.i18n.translate(
          'translation.trip.request.itemNotAvailable',
          {
            lang,
          },
        );
        throw new ConflictException(message);
      }
    }

    // Validate requested quantities don't exceed available quantities
    for (const requestedItem of request_items) {
      const tripItem = trip.trip_items.find(
        (item) => item.trip_item_id === requestedItem.trip_item_id,
      );

      if (tripItem && tripItem.avalailble_kg !== null) {
        const availableKg = Number(tripItem.avalailble_kg);

        if (requestedItem.quantity > availableKg) {
          const itemDetails = tripItem.trip_item;
          const message = await this.i18n.translate(
            'translation.trip.request.quantityExceedsAvailable',
            {
              lang,
              args: {
                itemName: itemDetails.name,
                requested: requestedItem.quantity,
                available: availableKg,
              },
              defaultValue: `Requested quantity (${requestedItem.quantity} kg) exceeds available quantity (${availableKg} kg) for ${itemDetails.name}`,
            },
          );
          throw new ConflictException(message);
        }
      }
    }

    try {
      // Calculate total cost using prices in user's currency
      // Sum of (quantity x price) for each requested item, using price in user's currency
      let totalCost = 0;
      for (const requestedItem of request_items) {
        const tripItem = trip.trip_items.find(
          (item) => item.trip_item_id === requestedItem.trip_item_id,
        );
        if (tripItem) {
          // Find price in user's currency from TripItemsListPrice
          const priceInUserCurrency = tripItem.prices?.find(
            (p) => p.currency === userCurrency,
          );

          if (priceInUserCurrency) {
            // Use price from TripItemsListPrice in user's currency
            totalCost +=
              requestedItem.quantity * Number(priceInUserCurrency.price);
          } else {
            // Fallback: if price not found in user currency, use trip currency price and convert
            const tripCurrencyPrice = Number(tripItem.price);
            const conversion = this.currencyService.convertCurrency(
              tripCurrencyPrice,
              trip.currency as Currency,
              userCurrency,
            );
            totalCost += requestedItem.quantity * conversion.convertedAmount;
          }
        }
      }

      // Create trip request with request items in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the trip request with calculated cost in user's currency
        const request = await prisma.tripRequest.create({
          data: {
            trip_id,
            user_id: userId,
            message: requestData.message,
            status: 'PENDING',
            cost: totalCost,
            currency: userCurrency,
          },
          select: {
            id: true,
            trip_id: true,
            user_id: true,
            status: true,
            message: true,
            cost: true,
            currency: true,
            created_at: true,
          },
        });

        // Create request items if provided (only for non-full suitcase trips)
        if (request_items && request_items.length > 0) {
          await prisma.tripRequestItem.createMany({
            data: request_items.map((item) => ({
              request_id: request.id,
              trip_item_id: item.trip_item_id,
              quantity: item.quantity,
              special_notes: item.special_notes,
            })),
          });
        }

        // Create images if provided
        let createdImages = [];
        if (images && images.length > 0) {
          createdImages = await Promise.all(
            images.map((image) =>
              prisma.image.create({
                data: {
                  object_id: request.id,
                  url: image.url,
                  alt_text: image.alt_text,
                },
                select: {
                  id: true,
                  url: true,
                  alt_text: true,
                },
              }),
            ),
          );
        }

        return {
          request,
          request_items: request_items || [],
          images: createdImages,
        };
      });

      // Create chat between request user and trip owner, and add request messages
      // This must succeed - if chat creation or messages fail, the operation fails
      const pickupData = trip.pickup as any;
      const destinationData = trip.destination as any;
      const departureCountry = pickupData?.country || 'Unknown';
      const destinationCountry = destinationData?.country || 'Unknown';
      const toWord = await this.i18n.translate('translation.chat.chatName.to', {
        lang,
      });
      const finalChatName = `${departureCountry} ${toWord} ${destinationCountry}`;

      // Optimized: Find existing chat in single query
      const existingChat = await this.prisma.chat.findFirst({
        where: {
          OR: [{ trip_id: trip.id }, { trip_id: null }],
          AND: [
            {
              members: {
                some: {
                  user_id: userId,
                },
              },
            },
            {
              members: {
                some: {
                  user_id: trip.user_id,
                },
              },
            },
            {
              members: {
                none: {
                  user_id: {
                    notIn: [userId, trip.user_id],
                  },
                },
              },
            },
          ],
        },
        include: {
          members: {
            select: { user_id: true },
          },
        },
      });

      let chatId: string;
      if (existingChat) {
        chatId = existingChat.id;

        // Check if this chat is already linked to another trip request
        const existingRequestWithChat = await this.prisma.tripRequest.findFirst(
          {
            where: {
              chat_id: chatId,
              id: { not: result.request.id }, // Exclude current request
            },
          },
        );

        // If chat is already linked to another request, try to create a new chat
        // If that fails (chat already exists), just use the existing chat without linking
        if (existingRequestWithChat) {
          try {
            // Try to create new chat for this request
            const chatResult = await this.chatService.createChat(
              {
                name: finalChatName,
                otherUserId: trip.user_id,
                tripId: trip.id,
                forceNewChat: true,
              },
              userId,
              lang,
            );

            chatId = chatResult.chat.id;

            // Update request with chat_id
            await this.prisma.tripRequest.update({
              where: { id: result.request.id },
              data: { chat_id: chatId },
            });

            // Notify chat creation (non-blocking)
            this.chatGateway
              .notifyChatCreated(
                chatId,
                [userId, trip.user_id],
                chatResult.chat.name || 'New Chat',
                chatResult.lastMessage,
              )
              .catch((error) => {
                console.error('Failed to notify chat creation:', error);
              });
          } catch (chatError: any) {
            // If createChat fails because chat already exists, just use existing chat
            // but don't link it to this request (to avoid unique constraint violation)
            if (chatError instanceof ConflictException) {
              // Use existing chat but don't link it - request will work without chat_id
              // The chat already exists and users can communicate through it
              chatId = existingChat.id;
              // Don't update request with chat_id since it's already linked to another request
              // Users can still use the existing chat for communication
            } else {
              // Re-throw other errors
              throw chatError;
            }
          }
        } else {
          // Chat is not linked to another request, safe to use
          try {
            // Update chat with trip_id if missing, and request with chat_id in parallel
            await Promise.all([
              existingChat.trip_id
                ? Promise.resolve()
                : this.prisma.chat.update({
                    where: { id: chatId },
                    data: { trip_id: trip.id },
                  }),
              this.prisma.tripRequest.update({
                where: { id: result.request.id },
                data: { chat_id: chatId },
              }),
            ]);
          } catch (error: any) {
            // Handle unique constraint violation - chat might have been linked by another concurrent request
            if (
              error.code === 'P2002' &&
              error.meta?.target?.includes('chat_id')
            ) {
              // Chat is now linked to another request, try to create a new chat
              try {
                const chatResult = await this.chatService.createChat(
                  {
                    name: finalChatName,
                    otherUserId: trip.user_id,
                    tripId: trip.id,
                    forceNewChat: true,
                  },
                  userId,
                  lang,
                );

                chatId = chatResult.chat.id;

                // Update request with new chat_id
                await this.prisma.tripRequest.update({
                  where: { id: result.request.id },
                  data: { chat_id: chatId },
                });

                // Notify chat creation (non-blocking)
                this.chatGateway
                  .notifyChatCreated(
                    chatId,
                    [userId, trip.user_id],
                    chatResult.chat.name || 'New Chat',
                    chatResult.lastMessage,
                  )
                  .catch((notifyError) => {
                    console.error(
                      'Failed to notify chat creation:',
                      notifyError,
                    );
                  });
              } catch (chatError: any) {
                // If createChat fails because chat already exists, just use existing chat
                // but don't link it to this request (to avoid unique constraint violation)
                if (chatError instanceof ConflictException) {
                  // Use existing chat but don't link it - request will work without chat_id
                  chatId = existingChat.id;
                  // Don't update request with chat_id since it's already linked to another request
                  // Users can still use the existing chat for communication
                } else {
                  // Re-throw other errors
                  throw chatError;
                }
              }
            } else {
              // Re-throw if it's a different error
              throw error;
            }
          }
        }
      } else {
        // Create new chat
        try {
          const chatResult = await this.chatService.createChat(
            {
              name: finalChatName,
              otherUserId: trip.user_id,
              tripId: trip.id,
            },
            userId,
            lang,
          );

          chatId = chatResult.chat.id;

          // Update request with chat_id
          await this.prisma.tripRequest.update({
            where: { id: result.request.id },
            data: { chat_id: chatId },
          });

          // Notify chat creation (non-blocking)
          this.chatGateway
            .notifyChatCreated(
              chatId,
              [userId, trip.user_id],
              chatResult.chat.name || 'New Chat',
              chatResult.lastMessage,
            )
            .catch((error) => {
              console.error('Failed to notify chat creation:', error);
            });
        } catch (chatError: any) {
          // If createChat fails because chat already exists, find and use existing chat
          if (chatError instanceof ConflictException) {
            // Find the existing chat that caused the conflict
            const conflictingChat = await this.prisma.chat.findFirst({
              where: {
                trip_id: trip.id,
                members: {
                  some: {
                    user_id: userId,
                  },
                },
                AND: {
                  members: {
                    some: {
                      user_id: trip.user_id,
                    },
                  },
                },
              },
            });

            if (conflictingChat) {
              chatId = conflictingChat.id;
              // Try to link it, but if it fails (already linked), that's okay
              // Request will work without chat_id
              try {
                await this.prisma.tripRequest.update({
                  where: { id: result.request.id },
                  data: { chat_id: chatId },
                });
              } catch (updateError: any) {
                // If unique constraint violation, just continue without linking
                // Users can still use the existing chat
                if (
                  updateError.code === 'P2002' &&
                  updateError.meta?.target?.includes('chat_id')
                ) {
                  // Chat is already linked to another request, that's fine
                  // Request will work without chat_id
                } else {
                  throw updateError;
                }
              }
            } else {
              // Couldn't find the chat, but request creation should still succeed
              // Just continue without chat_id
            }
          } else {
            // Re-throw other errors
            throw chatError;
          }
        }
      }

      // Prepare message contents in parallel
      const [systemMessageContent, requestMessageContent] = await Promise.all([
        this.i18n.translate('translation.chat.messages.systemRequestCreated', {
          lang,
          args: {
            status: 'PENDING',
          },
          defaultValue: 'System: New trip request created with status PENDING',
        }) as Promise<string>,
        this.i18n.translate('translation.chat.messages.newTripRequest', {
          lang,
        }) as Promise<string>,
      ]);

      // Send both messages in parallel - if either fails, entire operation fails
      const [systemMessage, requestMessage] = await Promise.all([
        this.chatGateway.sendMessageProgrammatically({
          chatId,
          senderId: userId,
          content: systemMessageContent,
          type: PrismaMessageType.SYSTEM,
          replyToId: undefined,
          requestId: result.request.id,
          messageData: { status: result.request.status },
        }),
        this.chatGateway.sendMessageProgrammatically({
          chatId,
          senderId: userId,
          content: requestMessageContent,
          type: PrismaMessageType.REQUEST,
          replyToId: undefined,
          requestId: result.request.id,
          messageData: { status: result.request.status },
        }),
      ]);

      // Validate messages were created successfully - fail entire operation if invalid
      if (!systemMessage?.id || !requestMessage?.id) {
        throw new InternalServerErrorException(
          'Failed to create request messages: messages missing IDs. Request was created but messages were not sent.',
        );
      }

      // Invalidate chat cache and user-specific cache for both users (non-blocking)
      Promise.all([
        this.redis.invalidateChatCache(chatId),
        this.redis.invalidateUserCache(trip.user_id),
        this.redis.invalidateUserCache(userId),
      ]).catch((cacheError) => {
        console.error('Failed to invalidate cache:', cacheError);
      });

      // Get full request details with trip items data
      const fullRequest = await this.prisma.tripRequest.findUnique({
        where: { id: result.request.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              picture: true,
              role: true,
              kycRecords: {
                select: {
                  id: true,
                  status: true,
                  provider: true,
                  rejectionReason: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
          request_items: {
            include: {
              trip_item: {
                include: {
                  image: true,
                  translations: true,
                },
              },
            },
          },
          trip: {
            select: {
              id: true,
              user_id: true,
              departure: true,
              destination: true,
              departure_date: true,
              departure_time: true,
              arrival_date: true,
              arrival_time: true,
              currency: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  picture: true,
                  role: true,
                  kycRecords: {
                    select: {
                      id: true,
                      status: true,
                      provider: true,
                      rejectionReason: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                  },
                },
              },
              trip_items: {
                include: {
                  prices: {
                    select: {
                      currency: true,
                      price: true,
                    },
                  },
                  trip_item: {
                    include: {
                      image: true,
                      translations: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Create notification for trip owner with full request data
      try {
        const departureLocation =
          (fullRequest.trip.departure as any)?.city ||
          (fullRequest.trip.departure as any)?.country ||
          'Unknown';
        const destinationLocation =
          (fullRequest.trip.destination as any)?.city ||
          (fullRequest.trip.destination as any)?.country ||
          'Unknown';

        const title = await this.i18n.translate(
          'translation.notification.newTripRequest.title',
          {
            lang,
            defaultValue: 'New Trip Request',
          },
        );

        const notificationMessage = await this.i18n.translate(
          'translation.notification.newTripRequest.message',
          {
            lang,
            defaultValue:
              '{requesterName} has requested to join your trip from {departure} to {destination}',
            args: {
              requesterName: fullRequest.user.name || 'A user',
              departure: departureLocation,
              destination: destinationLocation,
            },
          },
        );

        // Prepare full request data for notification
        const requestData = {
          id: fullRequest.id,
          trip_id: fullRequest.trip_id,
          user_id: fullRequest.user_id,
          status: fullRequest.status,
          message: fullRequest.message,
          cost: fullRequest.cost ? Number(fullRequest.cost) : null,
          currency: fullRequest.currency,
          created_at: fullRequest.created_at,
          user: {
            id: fullRequest.user.id,
            email: fullRequest.user.email,
            name: fullRequest.user.name,
            picture: fullRequest.user.picture,
            role: fullRequest.user.role,
            kycRecord: fullRequest.user.kycRecords?.[0] || null,
          },
          request_items: fullRequest.request_items.map((item) => {
            // Find the corresponding trip item with price data
            const tripItem = fullRequest.trip.trip_items.find(
              (ti) => ti.trip_item_id === item.trip_item_id,
            );

            return {
              trip_item_id: item.trip_item_id,
              quantity: item.quantity,
              special_notes: item.special_notes,
              trip_item: item.trip_item,
              price: tripItem ? Number(tripItem.price) : null,
              available_kg: tripItem
                ? tripItem.avalailble_kg
                  ? Number(tripItem.avalailble_kg)
                  : null
                : null,
              prices: tripItem?.prices
                ? tripItem.prices.map((p) => ({
                    currency: p.currency,
                    price: Number(p.price),
                  }))
                : [],
            };
          }),
          trip: {
            id: fullRequest.trip.id,
            departure: fullRequest.trip.departure,
            destination: fullRequest.trip.destination,
            departure_date: fullRequest.trip.departure_date,
            departure_time: fullRequest.trip.departure_time,
            currency: fullRequest.trip.currency,
            trip_items: fullRequest.trip.trip_items.map((ti) => ({
              trip_item_id: ti.trip_item_id,
              price: Number(ti.price),
              available_kg: ti.avalailble_kg ? Number(ti.avalailble_kg) : null,
              prices: ti.prices
                ? ti.prices.map((p) => ({
                    currency: p.currency,
                    price: Number(p.price),
                  }))
                : [],
              trip_item: ti.trip_item,
            })),
          },
        };

        // Get trip owner's device_id
        const tripOwner = await this.prisma.user.findUnique({
          where: { id: fullRequest.trip.user_id },
          select: { device_id: true },
        });

        await this.createRequestNotification(
          fullRequest.trip.user_id,
          title,
          notificationMessage,
          requestData,
          tripOwner?.device_id,
          true,
          'NEW_TRIP_REQUEST',
        );
      } catch (notificationError) {
        console.error(
          'Failed to create notification for trip owner:',
          notificationError,
        );
      }

      const message = await this.i18n.translate(
        'translation.trip.request.createSuccess',
        {
          lang,
        },
      );

      let averageRequestResponseTime: number | null = null;
      if (chatId) {
        const chatMessages = await this.prisma.message.findMany({
          where: { chat_id: chatId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            sender_id: true,
            createdAt: true,
          },
        });

        const responseTimes: number[] = [];
        let previousMessage: { sender_id: string; createdAt: Date } | null =
          null;
        for (const msg of chatMessages) {
          if (previousMessage && previousMessage.sender_id !== msg.sender_id) {
            if (msg.sender_id === trip.user_id) {
              const delta =
                msg.createdAt.getTime() - previousMessage.createdAt.getTime();
              if (delta >= 0) {
                responseTimes.push(delta);
              }
            }
          }
          previousMessage = msg;
        }

        if (responseTimes.length > 0) {
          const sum = responseTimes.reduce((acc, curr) => acc + curr, 0);
          averageRequestResponseTime = sum / responseTimes.length / 1000;
        }
      }

      return {
        message,
        request: {
          id: fullRequest.id,
          trip_id: fullRequest.trip_id,
          user_id: fullRequest.user_id,
          status: fullRequest.status,
          message: fullRequest.message,
          cost: fullRequest.cost ? Number(fullRequest.cost) : null,
          currency: fullRequest.currency,
          created_at: fullRequest.created_at,
          user: {
            id: fullRequest.user.id,
            email: fullRequest.user.email,
            name: fullRequest.user.name,
            picture: fullRequest.user.picture,
            role: fullRequest.user.role,
            kycRecord: fullRequest.user.kycRecords?.[0] || null,
          },
          trip: {
            id: fullRequest.trip.id,
            user_id: fullRequest.trip.user_id,
            user: {
              id: fullRequest.trip.user.id,
              email: fullRequest.trip.user.email,
              name: fullRequest.trip.user.name,
              picture: fullRequest.trip.user.picture,
              role: fullRequest.trip.user.role,
              kycRecord: fullRequest.trip.user.kycRecords?.[0] || null,
            },
            departure: fullRequest.trip.departure,
            destination: fullRequest.trip.destination,
            departure_date: fullRequest.trip.departure_date,
            departure_time: fullRequest.trip.departure_time,
            arrival_date: fullRequest.trip.arrival_date,
            arrival_time: fullRequest.trip.arrival_time,
            currency: fullRequest.trip.currency,
            trip_items: fullRequest.trip.trip_items.map((item) => ({
              trip_item_id: item.trip_item_id,
              price: Number(item.price),
              available_kg: item.avalailble_kg
                ? Number(item.avalailble_kg)
                : null,
              prices: item.prices
                ? item.prices.map((p) => ({
                    currency: p.currency,
                    price: Number(p.price),
                  }))
                : [],
              trip_item: item.trip_item,
            })),
          },
          request_items: fullRequest.request_items.map((item) => {
            // Find the price from trip_items
            const tripItemWithPrice = fullRequest.trip.trip_items.find(
              (ti) => ti.trip_item_id === item.trip_item_id,
            );
            return {
              trip_item_id: item.trip_item_id,
              quantity: item.quantity,
              price: tripItemWithPrice ? Number(tripItemWithPrice.price) : 0,
              special_notes: item.special_notes,
              trip_item: item.trip_item,
            };
          }),
          images: result.images,
        },
        average_request_response_time: averageRequestResponseTime,
      };
    } catch (error) {
      // Don't log ConflictException from chat creation - it's already handled
      if (!(error instanceof ConflictException)) {
        console.error('Failed to create trip request:', error);
      }
      const message = await this.i18n.translate(
        'translation.trip.request.createFailed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getTripRequests(
    query: GetTripRequestsQueryDto,
    lang?: string,
  ): Promise<GetTripRequestsResponseDto> {
    try {
      const { trip_id, user_id, status, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {
        is_deleted: false, // Exclude deleted requests
      };
      if (trip_id) whereClause.trip_id = trip_id;
      if (user_id) whereClause.user_id = user_id;
      if (status) whereClause.status = status;

      // Get requests with related data
      const [requests, total] = await Promise.all([
        this.prisma.tripRequest.findMany({
          where: whereClause,
          include: {
            trip: {
              select: {
                id: true,
                pickup: true,
                destination: true,
                departure_date: true,
                departure_time: true,
                currency: true,
                airline_id: true,
              },
            },
            user: {
              select: {
                id: true,
                email: true,
              },
            },
            request_items: {
              include: {
                trip_item: {
                  include: {
                    image: true,
                    translations: true,
                  },
                },
              },
            },
            images: {
              include: {
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
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.tripRequest.count({ where: whereClause }),
      ]);

      // Transform requests to summary format
      const requestSummaries = requests.map((request) => ({
        id: request.id,
        trip_id: request.trip_id,
        user_id: request.user_id,
        status: request.status,
        message: request.message,
        created_at: request.created_at,
        updated_at: request.updated_at,
        trip: {
          id: request.trip.id,
          pickup: request.trip.pickup,
          destination: request.trip.destination,
          departure_date: request.trip.departure_date,
          departure_time: request.trip.departure_time,
          currency: request.trip.currency,
          airline_id: request.trip.airline_id,
        },
        user: {
          id: request.user.id,
          email: request.user.email,
        },
        request_items: request.request_items.map((item) => ({
          trip_item_id: item.trip_item_id,
          quantity: item.quantity,
          special_notes: item.special_notes,
          trip_item: {
            id: item.trip_item.id,
            name: item.trip_item.name,
            description: item.trip_item.description,
            image: item.trip_item.image
              ? {
                  id: item.trip_item.image.id,
                  url: item.trip_item.image.url,
                  alt_text: item.trip_item.image.alt_text,
                }
              : undefined,
            translations: (item.trip_item as any).translations || [],
          },
        })),
        images: request.images.map((image) => ({
          id: image.image.id,
          url: image.image.url,
          alt_text: image.image.alt_text,
        })),
      }));

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.trip.request.getSuccess',
        { lang },
      );
      return {
        message,
        requests: requestSummaries,
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
      const message = await this.i18n.translate(
        'translation.trip.request.getFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getRequestById(
    requestId: string,
    lang?: string,
  ): Promise<GetRequestByIdResponseDto> {
    try {
      const request = await this.prisma.tripRequest.findFirst({
        where: {
          id: requestId,
          is_deleted: false, // Exclude deleted requests
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              picture: true,
              role: true,
              kycRecords: {
                select: {
                  id: true,
                  status: true,
                  provider: true,
                  rejectionReason: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
          trip: {
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
              mode_of_transport_id: true,
              airline_id: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  picture: true,
                  role: true,
                  kycRecords: {
                    select: {
                      id: true,
                      status: true,
                      provider: true,
                      rejectionReason: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                  },
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
                include: {
                  prices: {
                    select: {
                      currency: true,
                      price: true,
                    },
                  },
                  trip_item: {
                    include: {
                      image: true,
                    },
                  },
                },
              },
            },
          },
          request_items: {
            include: {
              trip_item: {
                include: {
                  image: true,
                },
              },
            },
          },
          images: {
            include: {
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
      });

      if (!request) {
        const message = await this.i18n.translate(
          'translation.trip.request.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      const message = await this.i18n.translate(
        'translation.trip.request.getByIdSuccess',
        {
          lang,
          defaultValue: 'Request retrieved successfully',
        },
      );

      return {
        message,
        request: {
          id: request.id,
          trip_id: request.trip_id,
          user_id: request.user_id,
          status: request.status,
          message: request.message,
          cost: request.cost ? Number(request.cost) : null,
          currency: request.currency,
          created_at: request.created_at,
          updated_at: request.updated_at,
          user: {
            id: request.user.id,
            email: request.user.email,
            name: request.user.name,
            picture: request.user.picture,
            role: request.user.role,
            kycRecord: request.user.kycRecords?.[0] || null,
          },
          trip: {
            id: request.trip.id,
            user_id: request.trip.user_id,
            user: {
              id: request.trip.user.id,
              email: request.trip.user.email,
              name: request.trip.user.name,
              picture: request.trip.user.picture,
              role: request.trip.user.role,
              kycRecord: request.trip.user.kycRecords?.[0] || null,
            },
            pickup: request.trip.pickup,
            departure: request.trip.departure,
            destination: request.trip.destination,
            delivery: request.trip.delivery,
            departure_date: request.trip.departure_date,
            departure_time: request.trip.departure_time,
            arrival_date: request.trip.arrival_date,
            arrival_time: request.trip.arrival_time,
            currency: request.trip.currency,
            maximum_weight_in_kg: request.trip.maximum_weight_in_kg
              ? Number(request.trip.maximum_weight_in_kg)
              : null,
            notes: request.trip.notes,
            meetup_flexible: request.trip.meetup_flexible,
            status: request.trip.status,
            mode_of_transport_id: request.trip.mode_of_transport_id,
            airline_id: request.trip.airline_id,
            mode_of_transport: request.trip.mode_of_transport,
            airline: request.trip.airline,
            trip_items: request.trip.trip_items.map((item) => ({
              trip_item_id: item.trip_item_id,
              price: Number(item.price),
              available_kg: item.avalailble_kg
                ? Number(item.avalailble_kg)
                : null,
              prices: item.prices
                ? item.prices.map((p) => ({
                    currency: p.currency,
                    price: Number(p.price),
                  }))
                : [],
              trip_item: item.trip_item,
            })),
          },
          request_items: request.request_items.map((item) => {
            const tripItemWithPrice = request.trip.trip_items.find(
              (ti) => ti.trip_item_id === item.trip_item_id,
            );
            return {
              trip_item_id: item.trip_item_id,
              quantity: item.quantity,
              price: tripItemWithPrice ? Number(tripItemWithPrice.price) : 0,
              special_notes: item.special_notes,
              trip_item: item.trip_item,
            };
          }),
          images: request.images.map((img) => ({
            id: img.image.id,
            url: img.image.url,
            alt_text: img.image.alt_text,
          })),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.trip.request.getByIdFailed',
        {
          lang,
          defaultValue: 'Failed to retrieve request',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async updateTripRequest(
    requestId: string,
    updateTripRequestDto: UpdateTripRequestDto,
    lang?: string,
  ): Promise<UpdateTripRequestResponseDto> {
    // Check if request exists
    const existingRequest = await this.prisma.tripRequest.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      const message = await this.i18n.translate(
        'translation.trip.request.notFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    try {
      const updateData: Record<string, unknown> = {};
      if (updateTripRequestDto.status !== undefined) {
        updateData.status = updateTripRequestDto.status;
      }
      if (updateTripRequestDto.message !== undefined) {
        updateData.message = updateTripRequestDto.message;
      }

      if (Object.keys(updateData).length === 0) {
        const message = await this.i18n.translate(
          'translation.trip.request.updateFailed',
          {
            lang,
            defaultValue:
              'No valid fields were provided to update this request',
          },
        );
        throw new BadRequestException(message);
      }

      const request = await this.prisma.tripRequest.update({
        where: { id: requestId },
        data: updateData,
        select: {
          id: true,
          trip_id: true,
          user_id: true,
          status: true,
          message: true,
          updated_at: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.trip.request.updateSuccess',
        {
          lang,
        },
      );

      return {
        message,
        request,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if ((error as any)?.code === 'P2025') {
        const message = await this.i18n.translate(
          'translation.trip.request.notFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      console.error('Failed to update trip request:', error);
      const message = await this.i18n.translate(
        'translation.trip.request.updateFailed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Admin edit request - allows editing more fields than regular update
   */
  async adminEditRequest(
    requestId: string,
    adminEditRequestDto: AdminEditRequestDto,
    lang?: string,
  ): Promise<AdminEditRequestResponseDto> {
    // Check if request exists
    const existingRequest = await this.prisma.tripRequest.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      const message = await this.i18n.translate(
        'translation.trip.request.notFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    try {
      // Prepare update data (only include fields that are provided)
      const updateData: any = {};
      if (adminEditRequestDto.status !== undefined) {
        updateData.status = adminEditRequestDto.status;
      }
      if (adminEditRequestDto.message !== undefined) {
        updateData.message = adminEditRequestDto.message;
      }
      if (adminEditRequestDto.cost !== undefined) {
        updateData.cost = adminEditRequestDto.cost;
      }
      if (adminEditRequestDto.currency !== undefined) {
        updateData.currency = adminEditRequestDto.currency;
      }
      if (adminEditRequestDto.payment_status !== undefined) {
        updateData.payment_status = adminEditRequestDto.payment_status;
      }
      if (adminEditRequestDto.payment_intent_id !== undefined) {
        updateData.payment_intent_id = adminEditRequestDto.payment_intent_id;
      }
      if (Object.keys(updateData).length === 0) {
        const message = await this.i18n.translate(
          'translation.trip.request.updateFailed',
          {
            lang,
            defaultValue:
              'No valid fields were provided to update this request',
          },
        );
        throw new BadRequestException(message);
      }

      const request = await this.prisma.tripRequest.update({
        where: { id: requestId },
        data: updateData,
        select: {
          id: true,
          trip_id: true,
          user_id: true,
          status: true,
          message: true,
          cost: true,
          currency: true,
          payment_status: true,
          payment_intent_id: true,
          updated_at: true,
        },
      });

      const message = await this.i18n.translate(
        'translation.trip.request.updateSuccess',
        {
          lang,
        },
      );

      return {
        message,
        request: {
          id: request.id,
          trip_id: request.trip_id,
          user_id: request.user_id,
          status: request.status,
          message: request.message || undefined,
          cost: request.cost ? Number(request.cost) : undefined,
          currency: request.currency || undefined,
          payment_status: request.payment_status || undefined,
          payment_intent_id: request.payment_intent_id || undefined,
          updated_at: request.updated_at,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      if ((error as any)?.code === 'P2025') {
        const message = await this.i18n.translate(
          'translation.trip.request.notFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      console.error('Failed to admin-edit trip request:', error);
      const message = await this.i18n.translate(
        'translation.trip.request.updateFailed',
        {
          lang,
        },
      );
      throw new InternalServerErrorException(message);
    }
  }
  /**
   * Admin delete request - soft delete by setting is_deleted to true
   */
  async adminDeleteRequest(
    requestId: string,
    lang?: string,
  ): Promise<AdminDeleteRequestResponseDto> {
    // Check if request exists
    const existingRequest = await this.prisma.tripRequest.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      const message = await this.i18n.translate(
        'translation.trip.request.notFound',
        {
          lang,
        },
      );
      throw new NotFoundException(message);
    }

    try {
      // Soft delete by setting is_deleted to true
      await this.prisma.tripRequest.update({
        where: { id: requestId },
        data: { is_deleted: true },
      });

      const message = await this.i18n.translate(
        'translation.admin.request.deleteSuccess',
        {
          lang,
          defaultValue: 'Request deleted successfully',
        },
      );

      return {
        message,
        requestId,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.admin.request.deleteFailed',
        {
          lang,
          defaultValue: 'Failed to delete request',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async changeRequestStatus(
    requestId: string,
    status: any,
    userId: string,
    lang?: string,
    from_app: boolean = false,
  ): Promise<any> {
    // Disallow manual setting of CONFIRMED; it must be set by the payment flow
    if (
      (!from_app && status === 'CONFIRMED') ||
      (!from_app && status === 'REVIEWED')
    ) {
      const message = await this.i18n.translate(
        'translation.request.status.confirmedOnlyByPayment',
        {
          lang,
          defaultValue:
            'CONFIRMED and REVIEWED status can only be set automatically ',
        },
      );
      throw new BadRequestException(message);
    }
    try {
      // Find the request by ID - explicitly include chat_id to ensure it's retrieved
      // Exclude deleted requests
      const request = await this.prisma.tripRequest.findFirst({
        where: {
          id: requestId,
          is_deleted: false,
        },
        select: {
          id: true,
          status: true,
          user_id: true,
          trip_id: true,
          chat_id: true, // Explicitly select chat_id
          payment_intent_id: true,
          currency: true,
          cost: true,
          message: true,
          created_at: true,
          updated_at: true,
          request_items: {
            include: {
              trip_item: true,
            },
          },
          images: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          trip: {
            select: {
              id: true,
              user_id: true,
              departure: true,
              destination: true,
              departure_date: true,
              departure_time: true,
              arrival_date: true,
              arrival_time: true,
              currency: true,
              user: true,
              trip_items: {
                include: {
                  trip_item: true,
                },
              },
            },
          },
        },
      });

      if (!request) {
        const message = await this.i18n.translate(
          'translation.trip.request.notFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Check if the user is authorized to change the status
      // Allow trip owner (traveler) or request sender to change status
      const isTripOwner = request.trip.user_id === userId;
      const isRequestSender = request.user_id === userId;

      if (!isTripOwner && !isRequestSender) {
        const message = await this.i18n.translate(
          'translation.trip.request.unauthorized',
          { lang },
        );
        throw new ConflictException(message);
      }

      // Get or create chat_id - ensure chat exists before sending messages
      let chatId: string | null = request.chat_id || null;
      if (!chatId) {
        try {
          console.warn(
            `Request ${requestId} missing chat_id. Finding or creating chat...`,
          );

          // Optimized: Find existing chat in single query
          // Find chat where both users are members and matches trip_id (or null)
          const existingChat = await this.prisma.chat.findFirst({
            where: {
              OR: [{ trip_id: request.trip_id }, { trip_id: null }],
              AND: [
                {
                  members: {
                    some: {
                      user_id: userId,
                    },
                  },
                },
                {
                  members: {
                    some: {
                      user_id: request.user_id,
                    },
                  },
                },
              ],
            },
            include: {
              members: {
                select: { user_id: true },
              },
            },
          });

          if (existingChat) {
            chatId = existingChat.id;

            // Update chat with trip_id if missing, and request with chat_id in parallel
            await Promise.all([
              existingChat.trip_id
                ? Promise.resolve()
                : this.prisma.chat.update({
                    where: { id: chatId },
                    data: { trip_id: request.trip_id },
                  }),
              this.prisma.tripRequest.update({
                where: { id: requestId },
                data: { chat_id: chatId },
              }),
            ]);
          } else {
            // Create new chat
            const trip = await this.prisma.trip.findUnique({
              where: { id: request.trip_id },
              select: { user_id: true },
            });

            if (!trip) {
              throw new NotFoundException('Trip not found for this request');
            }

            const chatResult = await this.chatService.createChat(
              {
                otherUserId:
                  userId === request.user_id ? trip.user_id : request.user_id,
                tripId: request.trip_id,
                messageContent: await this.i18n.translate(
                  'translation.chat.messages.newTripRequest',
                  { lang },
                ),
                messageType: MessageType.REQUEST,
                messageRequestId: requestId,
              },
              userId,
              lang,
            );

            chatId = chatResult.chat.id;

            // Update request with chat_id
            await this.prisma.tripRequest.update({
              where: { id: requestId },
              data: { chat_id: chatId },
            });
          }
        } catch (chatResolutionError) {
          // Status change should not fail if chat linkage fails
          console.error(
            `Failed to resolve chat for request ${requestId}:`,
            chatResolutionError,
          );
          chatId = null;
        }
      }

      // Determine if user is sender or traveler
      const isSender = request.user_id === userId;
      const isTraveler = request.trip.user_id === userId;

      // Validate status transitions using switch statement
      const currentStatus = request.status;
      switch (status) {
        case 'ACCEPTED':
        case 'DECLINED':
          // Only traveler can accept/decline
          if (!isTraveler) {
            throw new BadRequestException(
              'Only traveler can accept or decline requests',
            );
          }
          // Can only accept or decline if current status is PENDING
          if (currentStatus !== 'PENDING') {
            const message = await this.i18n.translate(
              'translation.trip.request.invalidTransition.mustBePending',
              {
                lang,
                defaultValue:
                  'Request must be in PENDING status to be accepted or declined',
              },
            );
            throw new BadRequestException(message);
          }
          break;

        case 'SENT':
          // Only sender can mark as sent
          if (!isSender) {
            throw new BadRequestException('Only sender can mark as sent');
          }
          // Can only mark as sent if current status is CONFIRMED
          if (currentStatus !== 'CONFIRMED') {
            throw new BadRequestException(
              'Request must be in CONFIRMED status to be marked as sent',
            );
          }
          break;

        case 'RECEIVED':
          // Only traveler can mark as received
          if (!isTraveler) {
            throw new BadRequestException('Only traveler can mark as received');
          }
          // Can only mark as received if current status is SENT
          if (currentStatus !== 'SENT') {
            throw new BadRequestException(
              'Request must be in SENT status to be marked as received',
            );
          }
          break;

        case 'PENDING_DELIVERY':
          // Only traveler can mark as pending delivery
          if (!isTraveler) {
            throw new BadRequestException(
              'Only traveler can mark as pending delivery',
            );
          }
          // Can only mark as pending delivery if current status is IN_TRANSIT
          if (currentStatus !== 'IN_TRANSIT') {
            throw new BadRequestException(
              'Request must be in IN_TRANSIT status to be marked as pending delivery',
            );
          }
          break;

        case 'CONFIRMED':
          // Only sender can confirm (after payment) or system can confirm
          if (!isSender) {
            throw new BadRequestException('Only sender can confirm requests');
          }
          // Can only confirm if current status is ACCEPTED
          if (currentStatus !== 'ACCEPTED') {
            const message = await this.i18n.translate(
              'translation.trip.request.invalidTransition.mustBeAccepted',
              {
                lang,
                defaultValue:
                  'Request must be in ACCEPTED status to be confirmed',
              },
            );
            throw new BadRequestException(message);
          }
          break;

        case 'DELIVERED':
          // Only sender can mark as delivered
          if (!isSender) {
            throw new BadRequestException('Only sender can mark as delivered');
          }
          // Can only mark as delivered if current status is PENDING_DELIVERY
          if (currentStatus !== 'PENDING_DELIVERY') {
            throw new BadRequestException(
              'Request must be in PENDING_DELIVERY status to be marked as delivered',
            );
          }

          // Move funds from hold to available for ALL payment types
          if (status === 'DELIVERED' && request.payment_intent_id) {
            try {
              // Find the transaction for this request
              const paymentTx = await this.prisma.transaction.findFirst({
                where: {
                  request_id: requestId,
                  userId: request.trip.user_id, // Traveler
                  source: 'TRIP_EARNING',
                  type: 'CREDIT',
                  status: 'ONHOLD',
                },
                orderBy: {
                  createdAt: 'desc',
                },
              });

              if (paymentTx) {
                const amountPaid = Number(paymentTx.amount_paid);
                const currency = paymentTx.currency;

                if (isNaN(amountPaid) || amountPaid <= 0) {
                  throw new BadRequestException('Invalid amount paid');
                }

                // Get traveler's wallet
                const travelerWallet = await this.prisma.wallet.findUnique({
                  where: { userId: request.trip.user_id },
                });

                if (!travelerWallet) {
                  throw new NotFoundException('Traveler wallet not found');
                }

                // Get currency-specific column names
                const getCurrencyColumns = (curr: string) => {
                  switch (curr.toUpperCase()) {
                    case 'EUR':
                      return {
                        available: 'available_balance_eur',
                        hold: 'hold_balance_eur',
                      };
                    case 'USD':
                      return {
                        available: 'available_balance_usd',
                        hold: 'hold_balance_usd',
                      };
                    case 'CAD':
                      return {
                        available: 'available_balance_cad',
                        hold: 'hold_balance_cad',
                      };
                    case 'XAF':
                      return {
                        available: 'available_balance_xaf',
                        hold: 'hold_balance_xaf',
                      };
                    default:
                      return {
                        available: 'available_balance_eur',
                        hold: 'hold_balance_eur',
                      };
                  }
                };

                const currencyColumns = getCurrencyColumns(currency);

                // Move funds from hold to available in a transaction
                await this.prisma.$transaction(async (prisma) => {
                  // Move funds from hold to available
                  await prisma.wallet.update({
                    where: { id: travelerWallet.id },
                    data: {
                      [currencyColumns.hold]: { decrement: amountPaid },
                      [currencyColumns.available]: { increment: amountPaid },
                    },
                  });

                  // Mark payment transaction as COMPLETED
                  await prisma.transaction.update({
                    where: { id: paymentTx.id },
                    data: { status: 'COMPLETED' },
                  });
                });

                console.log(
                  `Moved ${amountPaid} ${currency} from hold to available for traveler ${request.trip.user_id}`,
                );
              }
            } catch (settleErr) {
              console.error(
                `Failed to settle wallet for delivered request ${requestId}: ${
                  (settleErr as any)?.message || settleErr
                }`,
              );
              // Don't throw - allow status change to proceed
            }
          }
          break;

        case 'CANCELLED':
          // Sender or traveler can cancel; no status restrictions
          if (!isSender && !isTraveler) {
            throw new BadRequestException(
              'Only sender or traveler can cancel requests',
            );
          }
          break;
        case 'REFUNDED':
          // These can be set from any status (no restriction)
          break;

        default:
          throw new BadRequestException(`Invalid status: ${status}`);
      }
      // Update status first; chat/system messages are best-effort.
      const updatedRequest = await this.prisma.tripRequest.update({
        where: { id: requestId },
        data: { status },
      });

      let systemMessage: any = null;
      let statusMessage: any = null;

      if (chatId) {
        try {
          // Prepare message contents in parallel for better performance
          const [systemMessageContent, statusMessageContent] = await Promise.all([
            this.i18n.translate('translation.chat.messages.systemStatusUpdate', {
              lang,
              args: {
                status: status.toLowerCase(),
                newStatus: status,
              },
              defaultValue: `System: request status updated to ${status}`,
            }) as Promise<string>,
            this.i18n.translate('translation.chat.messages.requestStatusChanged', {
              lang,
              args: {
                status: status.toLowerCase(),
                requesterEmail: request.user.email,
              },
              defaultValue: `Request status changed to ${status}`,
            }) as Promise<string>,
          ]);

          [systemMessage, statusMessage] = await Promise.all([
            this.chatGateway.sendMessageProgrammatically({
              chatId,
              senderId: userId,
              content: systemMessageContent,
              type: PrismaMessageType.SYSTEM,
              replyToId: undefined,
              requestId: request.id,
              messageData: { status: status },
            }),
            this.chatGateway.sendMessageProgrammatically({
              chatId,
              senderId: userId,
              content: statusMessageContent,
              type: PrismaMessageType.REQUEST,
              replyToId: undefined,
              requestId: request.id,
              messageData: { status: status },
            }),
          ]);

          if (!systemMessage?.id || !statusMessage?.id) {
            throw new Error('status change messages created without IDs');
          }
        } catch (messageError) {
          console.error(
            `Failed to send status change messages for request ${requestId}:`,
            messageError,
          );
          systemMessage = null;
          statusMessage = null;
        }
      } else {
        console.warn(
          `Skipping status change messages for request ${requestId}: no chat_id available`,
        );
      }

      // Invalidate chat cache and user-specific cache
      try {
        if (chatId) {
          await this.redis.invalidateChatCache(chatId);
        }
        // Also invalidate cache for both users involved in the chat
        await this.redis.invalidateUserCache(userId); // Trip owner
        await this.redis.invalidateUserCache(request.user.id); // Requester
      } catch (cacheError) {
        console.error('Failed to invalidate cache:', cacheError);
      }

      // Create notification for the appropriate recipient based on status
      // When SENT: notify traveler (trip owner) to confirm reception
      // When RECEIVED: notify sender (requester) that package was received
      // For other statuses: notify the requester
      try {
        // Determine notification recipient based on status
        let notificationRecipientId: string;
        if (status === 'SENT') {
          // When sender marks as SENT, notify traveler to confirm reception
          notificationRecipientId = request.trip.user_id;
        } else if (status === 'RECEIVED') {
          // When traveler marks as RECEIVED, notify sender
          notificationRecipientId = request.user_id;
        } else {
          // For other statuses, notify requester
          notificationRecipientId = request.user_id;
        }

        const notificationRecipient = await this.prisma.user.findUnique({
          where: { id: notificationRecipientId },
          select: {
            id: true,
            email: true,
            name: true,
            device_id: true,
            lang: true,
          },
        });

        const departureLocation =
          (request.trip.departure as any)?.city ||
          (request.trip.departure as any)?.country ||
          'Unknown';
        const destinationLocation =
          (request.trip.destination as any)?.city ||
          (request.trip.destination as any)?.country ||
          'Unknown';

        // Use recipient's language for notification
        const recipientLang = notificationRecipient?.lang || 'en';

        const notificationTitle = await this.i18n.translate(
          'translation.notification.requestStatusChanged.title',
          {
            lang: recipientLang,
            defaultValue: 'Request Status Updated',
          },
        );

        const notificationMessage = await this.i18n.translate(
          `translation.notification.requestStatusChanged.${status.toLowerCase()}`,
          {
            lang: recipientLang,
            defaultValue:
              'Your trip request status has been changed to {status}',
            args: {
              status: status.toLowerCase(),
              departure: departureLocation,
              destination: destinationLocation,
            },
          },
        );

        // Prepare full request data for notification
        const requestData = {
          id: request.id,
          trip_id: request.trip_id,
          user_id: request.user_id,
          status: status,
          message: request.message,
          cost: request.cost ? Number(request.cost) : null,
          currency: request.currency,
          created_at: request.created_at,
          updated_at: request.updated_at,
          user: {
            id: request.user.id,
            email: request.user.email,
          },
          request_items: request.request_items.map((item) => {
            // Find the corresponding trip item with price data
            const tripItem = (request.trip as any).trip_items?.find(
              (ti: any) => ti.trip_item_id === item.trip_item_id,
            );

            return {
              trip_item_id: item.trip_item_id,
              quantity: item.quantity,
              special_notes: item.special_notes,
              price: tripItem ? Number(tripItem.price) : null,
              available_kg: tripItem
                ? tripItem.avalailble_kg
                  ? Number(tripItem.avalailble_kg)
                  : null
                : null,
              trip_item: (item as any).trip_item
                ? {
                    id: (item as any).trip_item.id,
                    name: (item as any).trip_item.name,
                    description: (item as any).trip_item.description,
                    image_id: (item as any).trip_item.image_id,
                  }
                : null,
            };
          }),
          trip: {
            id: request.trip.id,
            user_id: request.trip.user_id,
            departure: request.trip.departure,
            destination: request.trip.destination,
            departure_date: request.trip.departure_date,
            departure_time: request.trip.departure_time,
            user: {
              id: request.trip.user.id,
              email: request.trip.user.email,
              name: request.trip.user.name,
            },
            trip_items: (request.trip as any).trip_items?.map((ti: any) => ({
              trip_item_id: ti.trip_item_id,
              price: Number(ti.price),
              available_kg: ti.avalailble_kg ? Number(ti.avalailble_kg) : null,
              trip_item: ti.trip_item
                ? {
                    id: ti.trip_item.id,
                    name: ti.trip_item.name,
                    description: ti.trip_item.description,
                    image_id: ti.trip_item.image_id,
                  }
                : null,
            })),
            currency: request.trip.currency,
          },
        };

        // Delete all existing notifications for the notification recipient
        // concerning this request, before creating a new one, using trip_id and request_id fields
        try {
          await this.prisma.notification.deleteMany({
            where: {
              user_id: notificationRecipientId,
              type: 'REQUEST',
              trip_id: request.trip_id,
              request_id: request.id,
            },
          });
        } catch (deleteError) {
          console.error(
            'Failed to delete existing notifications:',
            deleteError,
          );
          // Continue with creating new notification even if deletion fails
        }

        await this.createRequestNotification(
          notificationRecipientId,
          notificationTitle,
          notificationMessage,
          requestData,
          notificationRecipient?.device_id,
          true,
          'REQUEST_STATUS_UPDATE',
        );
      } catch (notificationError) {
        console.error('Failed to send notification:', notificationError);
        // Don't fail the status change if notification fails
      }

      const message = await this.i18n.translate(
        'translation.trip.request.statusChanged',
        { lang },
      );

      return {
        message,
        request: {
          id: updatedRequest.id,
          status: updatedRequest.status,
          updatedAt: updatedRequest.updated_at,
        },
        chatMessage: statusMessage
          ? {
              id: statusMessage.id,
              chatId: statusMessage.chatId,
              content: statusMessage.content,
              type: statusMessage.type,
              createdAt: statusMessage.createdAt,
            }
          : null,
        systemMessage: systemMessage
          ? {
              id: systemMessage.id,
              chatId: systemMessage.chatId,
              content: systemMessage.content,
              type: systemMessage.type,
              createdAt: systemMessage.createdAt,
            }
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.trip.request.statusChangeFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Confirm delivery (by sender or traveler)
   */
  async confirmDelivery(
    orderId: string,
    userId: string,
    lang?: string,
  ): Promise<ConfirmDeliveryResponseDto> {
    try {
      // Get order with relations
      const order = await this.prisma.tripRequest.findUnique({
        where: { id: orderId },
        include: {
          trip: {
            include: {
              user: true, // Traveler
            },
          },
          user: true, // Sender
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Check if order is accepted and paid
      if (order.status !== 'ACCEPTED' && order.status !== 'CONFIRMED') {
        throw new BadRequestException('Order must be accepted first');
      }

      if (order.payment_status !== 'SUCCEEDED') {
        throw new BadRequestException('Order must be paid first');
      }

      // Determine if user is sender or traveler
      const isSender = order.user_id === userId;
      const isTraveler = order.trip.user_id === userId;

      if (!isSender && !isTraveler) {
        throw new BadRequestException(
          'You are not authorized to confirm this delivery',
        );
      }

      // Update confirmation status
      const updateData: any = {};
      if (isSender) {
        if (order.sender_confirmed_delivery) {
          throw new BadRequestException('You have already confirmed delivery');
        }
        updateData.sender_confirmed_delivery = true;
      } else {
        if (order.traveler_confirmed_delivery) {
          throw new BadRequestException('You have already confirmed delivery');
        }
        updateData.traveler_confirmed_delivery = true;
      }

      // Check if this is the first confirmation
      const isFirstConfirmation =
        !order.sender_confirmed_delivery && !order.traveler_confirmed_delivery;
      if (isFirstConfirmation) {
        updateData.delivered_at = new Date();
      }

      // Update order
      const updatedOrder = await this.prisma.tripRequest.update({
        where: { id: orderId },
        data: updateData,
      });

      const bothConfirmed =
        updatedOrder.sender_confirmed_delivery &&
        updatedOrder.traveler_confirmed_delivery;

      // If both parties confirmed, move earnings to available balance
      let earningsReleased = false;
      if (bothConfirmed) {
        try {
          await this.walletService.moveToAvailable(orderId);
          earningsReleased = true;

          // Get traveler's language preference and device_id
          const traveler = await this.prisma.user.findUnique({
            where: { id: order.trip.user_id },
            select: { lang: true, device_id: true },
          });
          const travelerLang = traveler?.lang || lang || 'en';

          // Notification data
          const currency = order.trip.currency || order.currency || 'XAF';
          const amount = Number(order.cost || 0);
          const moneyReleasedTitle = 'Money Released';
          const moneyReleasedMessage = `Your earnings of ${currency} ${amount.toFixed(2)} from order ${order.id} have been released to your available balance!`;
          const moneyReleasedData = {
            type: 'money_released',
            order_id: order.id,
            trip_id: order.trip_id,
            amount: amount,
            currency: currency,
          };

          // Create in-app notification and send push notification to traveler about money being released
          try {
            // Create in-app notification (always)
            await this.notificationService.createNotification(
              {
                user_id: order.trip.user_id, // traveler
                title: moneyReleasedTitle,
                message: moneyReleasedMessage,
                type: NotificationType.REQUEST,
                trip_id: order.trip_id,
                request_id: order.id,
                data: moneyReleasedData,
              },
              travelerLang,
            );

            // Send push notification if device_id exists
            if (traveler?.device_id) {
              await this.notificationService.sendPushNotificationToUser(
                order.trip.user_id, // traveler
                moneyReleasedTitle,
                moneyReleasedMessage,
                moneyReleasedData,
                travelerLang,
              );
            }
          } catch (error) {
            console.error(
              'Failed to create/send money released notification:',
              error,
            );
            // Don't fail the confirmation if notification fails
          }
        } catch (error) {
          console.error('Failed to release earnings:', error);
          // Don't fail the confirmation if wallet update fails
        }
      }

      const message = await this.i18n.translate(
        bothConfirmed
          ? 'translation.trip.request.deliveryConfirmedBoth'
          : 'translation.trip.request.deliveryConfirmedOne',
        { lang },
      );

      return {
        message: message || 'Delivery confirmed successfully',
        bothConfirmed,
        senderConfirmed: updatedOrder.sender_confirmed_delivery,
        travelerConfirmed: updatedOrder.traveler_confirmed_delivery,
        earningsReleased,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to confirm delivery');
    }
  }

  /**
   * Private helper method to calculate converted_cost array for all supported currencies
   * Returns array with request currency first, then other supported currencies
   */
  private calculateConvertedCost(
    cost: number | null,
    requestCurrency: string,
  ): Array<{ currency: string; price: number }> {
    if (!cost || cost <= 0) {
      return [];
    }

    const supportedCurrencies: Currency[] = [
      Currency.XAF,
      Currency.USD,
      Currency.EUR,
      Currency.CAD,
    ];

    const requestCurrencyUpper = requestCurrency.toUpperCase() as Currency;
    const convertedCosts: Array<{ currency: string; price: number }> = [];

    // Add request currency first
    convertedCosts.push({
      currency: requestCurrencyUpper,
      price: Number(cost),
    });

    // Add other supported currencies
    for (const targetCurrency of supportedCurrencies) {
      if (targetCurrency !== requestCurrencyUpper) {
        const conversion = this.currencyService.convertCurrency(
          cost,
          requestCurrencyUpper,
          targetCurrency,
        );
        convertedCosts.push({
          currency: targetCurrency,
          price: Number(conversion.convertedAmount.toFixed(2)),
        });
      }
    }

    return convertedCosts;
  }

  /**
   * Private helper method to create notification and send push/email notifications for request events
   */
  private async createRequestNotification(
    recipientUserId: string,
    title: string,
    message: string,
    requestData: any,
    deviceId?: string,
    sendEmail: boolean = false,
    emailTemplateType: 'NEW_TRIP_REQUEST' | 'REQUEST_STATUS_UPDATE' =
      'NEW_TRIP_REQUEST',
  ): Promise<void> {
    try {
      // Get recipient user preferences and normalize language
      const recipient = await this.prisma.user.findUnique({
        where: { id: recipientUserId },
        select: {
          id: true,
          email: true,
          name: true,
          lang: true,
          email_notification: true,
          push_notification: true,
        },
      });
      const recipientLangRaw = recipient?.lang || 'en';
      const recipientLang = recipientLangRaw
        ? recipientLangRaw.toLowerCase().trim()
        : 'en';
      const normalizedRecipientLang = recipientLang === 'fr' ? 'fr' : 'en';

      // Extract trip_id and request_id from requestData
      const tripId = requestData?.trip_id || requestData?.trip?.id || null;
      const requestId = requestData?.id || null;

      // Calculate converted_cost array and add it to requestData
      const cost = requestData?.cost || null;
      const currency = requestData?.currency || null;
      const convertedCost =
        cost && currency ? this.calculateConvertedCost(cost, currency) : [];
      const enrichedRequestData = {
        ...requestData,
        converted_cost: convertedCost,
      };

      // Create notification in database
      await this.notificationService.createNotification(
        {
          user_id: recipientUserId,
          title,
          message,
          type: 'REQUEST',
          trip_id: tripId,
          request_id: requestId,
          data: enrichedRequestData,
        },
        normalizedRecipientLang,
      );

      // Send push notification if user has device_id and push_notification enabled
      if (deviceId && recipient?.push_notification) {
        await this.notificationService.sendPushNotification(
          {
            deviceId,
            title,
            body: message,
            data: enrichedRequestData,
          },
          normalizedRecipientLang,
        );
      }

      // Send email notification when enabled by caller
      if (sendEmail && recipient?.email_notification && recipient?.email) {

        const departureLocation =
          (requestData?.trip?.departure as any)?.city ||
          (requestData?.trip?.departure as any)?.country ||
          null;
        const destinationLocation =
          (requestData?.trip?.destination as any)?.city ||
          (requestData?.trip?.destination as any)?.country ||
          null;
        const route =
          departureLocation && destinationLocation
            ? `${departureLocation} -> ${destinationLocation}`
            : null;
        const departureDate = requestData?.trip?.departure_date || null;

        let emailContent;
        if (emailTemplateType === 'NEW_TRIP_REQUEST') {
          const senderName =
            requestData?.user?.name || requestData?.user?.email || 'A user';
          const weightKg = Array.isArray(requestData?.request_items)
            ? requestData.request_items.reduce(
                (sum: number, item: any) => sum + (Number(item?.quantity) || 0),
                0,
              )
            : 0;
          const itemType = Array.isArray(requestData?.request_items)
            ? requestData.request_items
                .map((item: any) => item?.trip_item?.name)
                .filter((name: string | null | undefined) => !!name)
                .slice(0, 3)
                .join(', ')
            : '';

          emailContent = this.notificationService.buildNewTripRequestEmailContent({
            lang: normalizedRecipientLang,
            userName: recipient.name || recipient.email,
            senderName,
            route,
            departureDate,
            weightKg,
            itemType: itemType || 'Package',
          });
        } else {
          emailContent = this.notificationService.buildRequestStatusEmailContent({
            lang: normalizedRecipientLang,
            userName: recipient.name || recipient.email,
            route,
            departureDate,
            status: requestData?.status ? String(requestData.status) : null,
          });
        }

        await this.notificationService.sendEmail(
          {
            to: recipient.email,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          },
          normalizedRecipientLang,
        );
      }
    } catch (error) {
      console.error('Failed to create/send notification:', error);
      // Don't throw - notification failure shouldn't stop the main operation
    }
  }

  /**
   * Cancel a trip request with proper fee distribution
   */
  async cancelRequest(
    requestId: string,
    cancelRequestDto: CancelRequestDto,
    userId: string,
    lang?: string,
  ): Promise<CancelRequestResponseDto> {
    try {
      const cancellationResult = await this.cancellationService.cancelRequest(
        requestId,
        cancelRequestDto,
        userId,
        {
          changeStatus: async (status) => {
            await this.changeRequestStatus(
              requestId,
              status,
              userId,
              lang,
              true,
            );
          },
        },
      );

      const message = await this.i18n.translate(
        'translation.trip.request.cancelled',
        {
          lang,
          defaultValue: 'Trip request cancelled successfully',
        },
      );

      return {
        message,
        cancellation: cancellationResult,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to cancel request');
    }
  }

  async getUserRequests(
    userId: string,
    query: {
      direction: string;
      status?: string;
      page?: number;
      limit?: number;
    },
    lang?: string,
  ) {
    try {
      const { direction, status, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      let whereClause: any = {
        is_deleted: false, // Exclude deleted requests
      };

      if (direction === 'INCOMING') {
        // Requests on trips created by the user
        whereClause.trip = {
          user_id: userId,
        };
      } else if (direction === 'OUTGOING') {
        // Requests made by the user to other people's trips
        whereClause.user_id = userId;
      }

      // Add status filter if provided and not 'ALL'
      if (status && status !== 'ALL') {
        whereClause.status = status;
      }

      // Get total count
      const total = await this.prisma.tripRequest.count({
        where: whereClause,
      });

      // Fetch requests
      const requests = await this.prisma.tripRequest.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
        select: {
          id: true,
          trip_id: true,
          user_id: true,
          status: true,
          cost: true,
          currency: true,
          message: true,
          created_at: true,
          updated_at: true,
          chat_id: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              picture: true,
            },
          },
          trip: {
            select: {
              id: true,
              departure: true,
              destination: true,
              departure_date: true,
              status: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  picture: true,
                },
              },
              trip_items: {
                select: {
                  trip_item_id: true,
                  prices: {
                    select: {
                      currency: true,
                      price: true,
                    },
                  },
                },
              },
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

      // Fetch chat info for requests that have a chat_id
      const requestIdsWithChat = requests
        .filter((r) => r.chat_id)
        .map((r) => r.chat_id!);

      const chats =
        requestIdsWithChat.length > 0
          ? await this.prisma.chat.findMany({
              where: {
                id: {
                  in: requestIdsWithChat,
                },
              },
              select: {
                id: true,
                name: true,
                createdAt: true,
              },
            })
          : [];

      // Create a map of chat_id -> chat_info for quick lookup
      const chatInfoMap = new Map(
        chats.map((chat) => [
          chat.id,
          {
            id: chat.id,
            name: chat.name,
            createdAt: chat.createdAt,
          },
        ]),
      );

      // Get user's currency
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { currency: true },
      });
      const userCurrency = (user?.currency || 'XAF').toUpperCase();

      // Transform requests
      const transformedRequests = requests.map((request) => {
        // Create a map of trip_item_id -> prices for quick lookup
        const tripItemPricesMap = new Map(
          request.trip.trip_items.map((tripItem) => [
            tripItem.trip_item_id,
            tripItem.prices.map((p) => ({
              currency: p.currency,
              price: Number(p.price),
            })),
          ]),
        );

        // Convert cost to user's currency if needed
        let cost = request.cost ? Number(request.cost) : null;
        let currency: Currency | null = request.currency || ('XAF' as Currency);

        if (cost && currency && currency.toUpperCase() !== userCurrency) {
          try {
            const conversion = this.currencyService.convertCurrency(
              cost,
              currency.toUpperCase(),
              userCurrency,
            );
            cost = conversion.convertedAmount;
            currency = userCurrency as Currency;
          } catch (error) {
            console.error(
              `Failed to convert currency for request ${request.id}:`,
              error,
            );
            // Keep original cost and currency if conversion fails
          }
        } else if (currency) {
          // Ensure currency is uppercase
          currency = currency.toUpperCase() as Currency;
        }

        return {
          id: request.id,
          trip_id: request.trip_id,
          user_id: request.user_id,
          status: request.status,
          cost,
          currency,
          message: request.message,
          created_at: request.created_at,
          updated_at: request.updated_at,
          user: request.user,
          trip: {
            id: request.trip.id,
            departure: request.trip.departure,
            destination: request.trip.destination,
            departure_date: request.trip.departure_date,
            status: request.trip.status,
            user: request.trip.user,
          },
          request_items: request.request_items.map((item) => ({
            trip_item_id: item.trip_item_id,
            quantity: item.quantity,
            special_notes: item.special_notes,
            trip_item: item.trip_item
              ? {
                  ...item.trip_item,
                  translations: item.trip_item.translations || [],
                }
              : null,
            prices: tripItemPricesMap.get(item.trip_item_id) || [],
          })),
          chat_info: request.chat_id
            ? chatInfoMap.get(request.chat_id) || null
            : null,
        };
      });

      const message = await this.i18n.translate(
        'translation.request.getUserRequests.success',
        {
          lang,
          defaultValue: 'Requests retrieved successfully',
        },
      );

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        message,
        requests: transformedRequests,
        total,
        page,
        limit,
        totalPages,
        hasNext,
        hasPrev,
      };
    } catch (error) {
      console.error('Error getting user requests:', error);
      const message = await this.i18n.translate(
        'translation.request.getUserRequests.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve requests',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Rate a delivered trip request
   * Only the sender (user who created the request) can rate
   */
  async rateRequest(
    rateRequestDto: RateRequestDto,
    userId: string,
    lang: string = 'en',
  ): Promise<RateRequestResponseDto> {
    const { requestId, rating, comment } = rateRequestDto;

    try {
      // Get the request with trip and user information (exclude deleted)
      const request = await this.prisma.tripRequest.findFirst({
        where: {
          id: requestId,
          is_deleted: false, // Exclude deleted requests
        },
        include: {
          trip: {
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
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!request) {
        const message = await this.i18n.translate(
          'translation.request.notFound',
          {
            lang,
            defaultValue: 'Request not found',
          },
        );
        throw new NotFoundException(message);
      }

      // Check if request status is DELIVERED
      if (request.status !== 'DELIVERED') {
        const message = await this.i18n.translate(
          'translation.request.rate.statusNotDelivered',
          {
            lang,
            defaultValue: 'You can only rate requests that have been delivered',
          },
        );
        throw new BadRequestException(message);
      }

      // Check if the user is the sender (user who created the request)
      if (request.user_id !== userId) {
        const message = await this.i18n.translate(
          'translation.request.rate.unauthorized',
          {
            lang,
            defaultValue: 'Only the sender can rate this request',
          },
        );
        throw new ForbiddenException(message);
      }

      // Check if user has already rated this request
      const existingRating = await this.prisma.rating.findFirst({
        where: {
          request_id: requestId,
          giver_id: userId,
        },
      });

      if (existingRating) {
        const message = await this.i18n.translate(
          'translation.request.rate.alreadyRated',
          {
            lang,
            defaultValue: 'You have already rated this request',
          },
        );
        throw new ConflictException(message);
      }

      // Create the rating
      // Receiver is the traveler (trip owner)
      const receiverId = request.trip.user_id;

      const newRating = await this.prisma.rating.create({
        data: {
          giver_id: userId,
          receiver_id: receiverId,
          trip_id: request.trip_id,
          request_id: requestId,
          rating,
          comment: comment || null,
        },
        include: {
          giver: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          receiver: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      // Update request status to REVIEWED using existing status change workflow
      try {
        await this.changeRequestStatus(
          requestId,
          'REVIEWED',
          userId,
          lang,
          true,
        );
      } catch (statusError) {
        console.error(
          'Failed to update request status to REVIEWED after rating:',
          statusError,
        );
      }

      // // Send a REVIEW message in the chat if chat exists
      // if (request.chat_id) {
      //   try {
      //     // Get the review message content
      //     const reviewContent = await this.i18n.translate(
      //       'translation.chat.messages.reviewSubmitted',
      //       {
      //         lang,
      //         args: {
      //           rating: rating.toString(),
      //         },
      //         defaultValue: `Rating submitted: ${rating}/5`,
      //       },
      //     );

      //     // Send review message with review_id
      //     await this.chatGateway.sendMessageProgrammatically({
      //       chatId: request.chat_id,
      //       senderId: userId,
      //       content: reviewContent,
      //       type: PrismaMessageType.REVIEW,
      //       requestId: undefined,
      //       reviewId: newRating.id,
      //     });

      //     // Invalidate chat cache
      //     await this.redis.invalidateChatCache(request.chat_id);
      //   } catch (messageError) {
      //     console.error('Failed to send review message in chat:', messageError);
      //     // Don't throw - rating was created successfully
      //   }
      // }

      const message = await this.i18n.translate(
        'translation.request.rate.success',
        {
          lang,
          defaultValue: 'Request rated successfully',
        },
      );

      return {
        message,
        ratingId: newRating.id,
        rating: {
          id: newRating.id,
          rating: newRating.rating,
          comment: newRating.comment,
          createdAt: newRating.created_at,
          giver: {
            id: newRating.giver.id,
            email: newRating.giver.email,
            name: newRating.giver.name,
          },
          receiver: {
            id: newRating.receiver.id,
            email: newRating.receiver.email,
            name: newRating.receiver.name,
          },
        },
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Error rating request:', error);
      const message = await this.i18n.translate(
        'translation.request.rate.failed',
        {
          lang,
          defaultValue: 'Failed to rate request',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get request statistics for admin
   * Returns all requests for a given period with sums per status and total sum
   */
  async getAdminRequestStatistics(
    query: AdminRequestStatisticsQueryDto,
    lang?: string,
  ): Promise<AdminRequestStatisticsResponseDto> {
    try {
      const { from, to } = query;
      const fromDate = new Date(from);
      const toDate = new Date(to);

      // Validate date range
      if (fromDate > toDate) {
        throw new BadRequestException(
          'From date must be before or equal to to date',
        );
      }

      // Get all requests in the period
      const requests = await this.prisma.tripRequest.findMany({
        where: {
          created_at: {
            gte: fromDate,
            lte: toDate,
          },
        },
        select: {
          id: true,
          trip_id: true,
          user_id: true,
          status: true,
          cost: true,
          currency: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      // Calculate statistics grouped by status
      const statusMap = new Map<string, { count: number; totalCost: number }>();

      // Initialize all possible statuses (convert to strings for map keys)
      const allStatuses: string[] = [
        RequestStatus.PENDING,
        RequestStatus.ACCEPTED,
        RequestStatus.DECLINED,
        RequestStatus.CANCELLED,
        RequestStatus.REFUNDED,
        RequestStatus.EXPIRED,
        RequestStatus.CONFIRMED,
        RequestStatus.SENT,
        RequestStatus.RECEIVED,
        RequestStatus.IN_TRANSIT,
        RequestStatus.PENDING_DELIVERY,
        RequestStatus.DELIVERED,
        RequestStatus.REVIEWED,
      ].map((s) => String(s));

      // Initialize all statuses with zero values
      allStatuses.forEach((status) => {
        statusMap.set(status, { count: 0, totalCost: 0 });
      });

      // Calculate totals
      let totalCount = 0;
      let totalCost = 0;

      // Process each request
      requests.forEach((request) => {
        // Convert status to string to ensure consistent map key lookup
        const status = String(request.status);
        const cost = request.cost ? Number(request.cost) : 0;

        // Update status map (initialize if not exists)
        const statusData = statusMap.get(status) || { count: 0, totalCost: 0 };
        statusData.count += 1;
        statusData.totalCost += cost;
        statusMap.set(status, statusData);

        // Update totals
        totalCount += 1;
        totalCost += cost;
      });

      // Convert status map to array
      const statusSummary = Array.from(statusMap.entries())
        .map(([status, data]) => ({
          status,
          count: data.count,
          totalCost: Number(data.totalCost.toFixed(2)),
        }))
        .filter((item) => item.count > 0) // Only include statuses with requests
        .sort((a, b) => b.count - a.count); // Sort by count descending

      const message = await this.i18n.translate(
        'translation.request.admin.statistics.success',
        {
          lang,
          defaultValue: 'Request statistics retrieved successfully',
        },
      );

      return {
        message,
        requests: requests.map((request) => ({
          id: request.id,
          trip_id: request.trip_id,
          user_id: request.user_id,
          status: request.status,
          cost: request.cost ? Number(request.cost) : null,
          currency: request.currency,
          created_at: request.created_at,
          updated_at: request.updated_at,
        })),
        statusSummary,
        totalCount,
        totalCost: Number(totalCost.toFixed(2)),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error getting admin request statistics:', error);
      const message = await this.i18n.translate(
        'translation.request.admin.statistics.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve request statistics',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get request details for admin with currency in EUR and all transactions
   */
  async getAdminRequestById(
    requestId: string,
    lang?: string,
  ): Promise<AdminGetRequestByIdResponseDto> {
    try {
      const request = await this.prisma.tripRequest.findFirst({
        where: {
          id: requestId,
          is_deleted: false,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
              picture: true,
            },
          },
          trip: {
            select: {
              id: true,
              user_id: true,
              pickup: true,
              departure: true,
              destination: true,
              departure_date: true,
              status: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                  picture: true,
                },
              },
            },
          },
          request_items: {
            include: {
              trip_item: {
                include: {
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
          transactions: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 5, // Return only the last 5 transactions
          },
        },
      });

      if (!request) {
        const message = await this.i18n.translate(
          'translation.trip.request.notFound',
          {
            lang,
          },
        );
        throw new NotFoundException(message);
      }

      // Convert cost to EUR
      let costEur: number | null = null;
      if (request.cost && request.currency) {
        try {
          const conversion = this.currencyService.convertCurrency(
            Number(request.cost),
            request.currency.toUpperCase() as Currency,
            Currency.EUR,
          );
          costEur = Number(conversion.convertedAmount.toFixed(2));
        } catch (error) {
          console.error('Failed to convert cost to EUR:', error);
          // Keep costEur as null if conversion fails
        }
      }

      // Convert all transaction amounts to EUR
      const transactionsEur = await Promise.all(
        request.transactions.map(async (transaction) => {
          let amountRequestedEur = Number(transaction.amount_requested);
          let amountPaidEur = Number(transaction.amount_paid);
          let feeAppliedEur = Number(transaction.fee_applied);
          let balanceAfterEur = transaction.balance_after
            ? Number(transaction.balance_after)
            : null;

          if (transaction.currency && transaction.currency.toUpperCase() !== 'EUR') {
            try {
              const conversion = this.currencyService.convertCurrency(
                1,
                transaction.currency.toUpperCase() as Currency,
                Currency.EUR,
              );
              const rate = conversion.convertedAmount;
              amountRequestedEur = Number(
                (Number(transaction.amount_requested) * rate).toFixed(2),
              );
              amountPaidEur = Number(
                (Number(transaction.amount_paid) * rate).toFixed(2),
              );
              feeAppliedEur = Number(
                (Number(transaction.fee_applied) * rate).toFixed(2),
              );
              if (balanceAfterEur !== null) {
                balanceAfterEur = Number((balanceAfterEur * rate).toFixed(2));
              }
            } catch (error) {
              console.error(
                `Failed to convert transaction ${transaction.id} to EUR:`,
                error,
              );
              // Keep original values if conversion fails
            }
          }

          return {
            id: transaction.id,
            userId: transaction.userId,
            trip_id: transaction.trip_id,
            request_id: transaction.request_id,
            amount_requested: amountRequestedEur,
            fee_applied: feeAppliedEur,
            amount_paid: amountPaidEur,
            wallet_id: transaction.wallet_id,
            currency: 'EUR',
            status_message: transaction.status_message,
            description: transaction.description,
            metadata: transaction.metadata,
            reference: transaction.reference,
            balance_after: balanceAfterEur,
            createdAt: transaction.createdAt,
            processedAt: transaction.processedAt,
            updatedAt: transaction.updatedAt,
            type: transaction.type,
            source: transaction.source,
            status: transaction.status,
            provider: transaction.provider,
            provider_id: transaction.provider_id,
            stripe_transfer_id: transaction.stripe_transfer_id,
            stripe_account_id: transaction.stripe_account_id,
            phone_number: transaction.phone_number,
          };
        }),
      );

      const message = await this.i18n.translate(
        'translation.request.admin.getById.success',
        {
          lang,
          defaultValue: 'Request details retrieved successfully',
        },
      );

      return {
        message,
        request: {
          id: request.id,
          trip_id: request.trip_id,
          user_id: request.user_id,
          status: request.status,
          message: request.message,
          cost: request.cost ? Number(request.cost) : null,
          cost_eur: costEur,
          currency: 'EUR',
          payment_status: request.payment_status,
          payment_intent_id: request.payment_intent_id,
          paid_at: request.paid_at,
          created_at: request.created_at,
          updated_at: request.updated_at,
          sender_confirmed_delivery: request.sender_confirmed_delivery,
          traveler_confirmed_delivery: request.traveler_confirmed_delivery,
          delivered_at: request.delivered_at,
          cancelled_at: request.cancelled_at,
          cancellation_type: request.cancellation_type,
          cancellation_reason: request.cancellation_reason,
          chat_id: request.chat_id,
          is_deleted: request.is_deleted,
          user: {
            id: request.user.id,
            email: request.user.email,
            name: request.user.name,
            firstName: request.user.firstName ?? null,
            lastName: request.user.lastName ?? null,
            picture: request.user.picture,
          },
          trip: {
            id: request.trip.id,
            user_id: request.trip.user_id,
            pickup: request.trip.pickup,
            departure: request.trip.departure,
            destination: request.trip.destination,
            departure_date: request.trip.departure_date,
            status: request.trip.status,
            user: {
              id: request.trip.user.id,
              email: request.trip.user.email,
              name: request.trip.user.name,
              firstName: request.trip.user.firstName ?? null,
              lastName: request.trip.user.lastName ?? null,
              picture: request.trip.user.picture,
            },
          },
          request_items: request.request_items.map((item) => ({
            trip_item_id: item.trip_item_id,
            quantity: item.quantity,
            special_notes: item.special_notes,
            trip_item: item.trip_item
              ? {
                  id: item.trip_item.id,
                  name: item.trip_item.name,
                  description: item.trip_item.description,
                  image: item.trip_item.image
                    ? {
                        id: item.trip_item.image.id,
                        url: item.trip_item.image.url,
                        alt_text: item.trip_item.image.alt_text,
                      }
                    : null,
                  translations: item.trip_item.translations || [],
                }
              : null,
          })),
          transactions: transactionsEur,
        } as AdminGetRequestByIdResponseDto['request'],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error getting admin request details:', error);
      const message = await this.i18n.translate(
        'translation.request.admin.getById.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve request details',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }
}
