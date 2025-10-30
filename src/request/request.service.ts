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
import { MessageType as PrismaMessageType, UserRole } from 'generated/prisma';
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
import { GetRequestByIdResponseDto } from './dto/get-request-by-id.dto';
import { ConfirmDeliveryResponseDto } from './dto/confirm-delivery.dto';
import {
  CancelRequestDto,
  CancelRequestResponseDto,
} from './dto/cancel-request.dto';
import { RateRequestDto, RateRequestResponseDto } from './dto/rate-request.dto';
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

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
      // Calculate total cost: sum of (quantity × price) for each requested item
      let totalCost = 0;
      for (const requestedItem of request_items) {
        const tripItem = trip.trip_items.find(
          (item) => item.trip_item_id === requestedItem.trip_item_id,
        );
        if (tripItem) {
          totalCost += requestedItem.quantity * Number(tripItem.price);
        }
      }

      // Create trip request with request items in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the trip request with calculated cost and currency from trip
        const request = await prisma.tripRequest.create({
          data: {
            trip_id,
            user_id: userId,
            message: requestData.message,
            status: 'PENDING',
            cost: totalCost,
            currency: trip.currency,
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

      // Create chat between request user and trip owner, and add a request message
      try {
        // Create chat name from trip departure and destination countries
        const pickupData = trip.pickup as any;
        const destinationData = trip.destination as any;
        const departureCountry = pickupData?.country || 'Unknown';
        const destinationCountry = destinationData?.country || 'Unknown';
        const toWord = await this.i18n.translate(
          'translation.chat.chatName.to',
          { lang },
        );
        const chatName = `${departureCountry} ${toWord} ${destinationCountry}`;

        // Check if there's already a chat between these users
        const allChats = await this.prisma.chat.findMany({
          where: {
            members: {
              some: {
                user_id: userId,
              },
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    role: true,
                  },
                },
              },
            },
          },
        });

        // Find a chat where both users are members
        let existingChat = allChats.find((chat) => {
          const memberIds = chat.members.map((m) => m.user_id);
          return memberIds.includes(userId) && memberIds.includes(trip.user_id);
        });

        let chatResult;
        if (existingChat) {
          // If chat exists, update trip_id if missing
          if (!existingChat.trip_id) {
            existingChat = await this.prisma.chat.update({
              where: { id: existingChat.id },
              data: {
                trip_id: trip.id,
              },
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        role: true,
                      },
                    },
                  },
                },
              },
            });
          }

          // Use existing chat
          chatResult = {
            message: await this.i18n.translate(
              'translation.chat.create.chatAlreadyExists',
              { lang },
            ),
            chat: {
              id: existingChat.id,
              name: existingChat.name,
              createdAt: existingChat.createdAt,
              members: existingChat.members.map((member) => ({
                id: member.user_id,
                email: member.user?.email || '',
                role: member.user?.role || 'USER',
              })),
            },
          };
        } else {
          console.log('New chat');
          // Create new chat
          chatResult = await this.chatService.createChat(
            {
              name: chatName,
              otherUserId: trip.user_id,
              tripId: trip.id,
              messageContent: await this.i18n.translate(
                'translation.chat.messages.newTripRequest',
                { lang },
              ),
              messageType: MessageType.REQUEST,
              messageRequestId: result.request.id,
            },
            userId,
            lang,
          );
          await this.chatGateway.notifyChatCreated(
            chatResult.chat.id,
            [userId, trip.user_id],
            chatResult.chat.name || 'New Chat',
            chatResult.lastMessage,
          );
        }

        // Update the request with chat_id
        await this.prisma.tripRequest.update({
          where: { id: result.request.id },
          data: {
            chat_id: chatResult.chat.id,
          },
        });

        // Send a message in the chat for existing chats
        // (for new chats, the message was already created in createChat)
        try {
          if (existingChat) {
            console.log('Existing chat - sending message programmatically');
            // Send message to notify about the new request
            await this.chatGateway.sendMessageProgrammatically({
              chatId: chatResult.chat.id,
              senderId: userId,
              content: await this.i18n.translate(
                'translation.chat.messages.newTripRequest',
                { lang },
              ),
              type: PrismaMessageType.REQUEST,
              replyToId: undefined,
              imageUrl: undefined,
              requestId: result.request.id,
            });
          }
        } catch (messageError) {
          console.error(
            'Failed to send message in existing chat:',
            messageError,
          );
        }

        // Invalidate chat cache and user-specific cache for both users
        try {
          await this.redis.invalidateChatCache(chatResult.chat.id);
          // Invalidate cache for both users involved in the chat
          await this.redis.invalidateUserCache(trip.user_id); // Trip owner
          await this.redis.invalidateUserCache(userId); // Requester
        } catch (cacheError) {
          console.error('Failed to invalidate cache:', cacheError);
        }
      } catch (chatError) {
        // Log the error but don't fail the request creation
        console.error('Failed to create chat/message for request:', chatError);
      }

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
                  trip_item: {
                    include: {
                      image: true,
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
            };
          }),
          trip: {
            id: fullRequest.trip.id,
            departure: fullRequest.trip.departure,
            destination: fullRequest.trip.destination,
            departure_date: fullRequest.trip.departure_date,
            departure_time: fullRequest.trip.departure_time,
            trip_items: fullRequest.trip.trip_items.map((ti) => ({
              trip_item_id: ti.trip_item_id,
              price: Number(ti.price),
              available_kg: ti.avalailble_kg ? Number(ti.avalailble_kg) : null,
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
      };
    } catch (error) {
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
      const whereClause: any = {};
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
      const request = await this.prisma.tripRequest.findUnique({
        where: { id: requestId },
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
      const request = await this.prisma.tripRequest.update({
        where: { id: requestId },
        data: updateTripRequestDto,
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
      const message = await this.i18n.translate(
        'translation.trip.request.updateFailed',
        {
          lang,
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
  ): Promise<any> {
    // Disallow manual setting of CONFIRMED; it must be set by the payment flow
    if (status === 'CONFIRMED') {
      const message = await this.i18n.translate(
        'translation.request.status.confirmedOnlyByPayment',
        {
          lang,
          defaultValue:
            'CONFIRMED status can only be set automatically after successful payment',
        },
      );
      throw new BadRequestException(message);
    }
    try {
      // Find the request by ID - explicitly include chat_id to ensure it's retrieved
      const request = await this.prisma.tripRequest.findUnique({
        where: { id: requestId },
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
            include: {
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

      // Get chat_id from request
      let chatId: string;
      if (!request.chat_id) {
        console.error(
          `Request ${requestId} does not have a chat_id. Request status: ${request.status}, Trip ID: ${request.trip_id}, User ID: ${request.user_id}`,
        );
        // Try to find or create a chat if it doesn't exist
        // First, try to find an existing chat between the users
        const allChats = await this.prisma.chat.findMany({
          where: {
            members: {
              some: {
                user_id: userId, // Current user (could be sender or traveler)
              },
            },
          },
          include: {
            members: true,
          },
        });

        const existingChat = allChats.find((chat) => {
          const memberIds = chat.members.map((m) => m.user_id);
          return (
            memberIds.includes(userId) &&
            memberIds.includes(request.user_id) &&
            (chat.trip_id === request.trip_id || chat.trip_id === null)
          );
        });
        if (existingChat) {
          // Use existing chat and update both chat and request
          chatId = existingChat.id;

          // Update chat with trip_id if missing
          if (!existingChat.trip_id) {
            await this.prisma.chat.update({
              where: { id: chatId },
              data: { trip_id: request.trip_id },
            });
            console.log(
              `Updated chat ${chatId} with trip_id ${request.trip_id}`,
            );
          }

          // Update request with chat_id
          await this.prisma.tripRequest.update({
            where: { id: requestId },
            data: { chat_id: chatId },
          });
          console.log(`Found existing chat ${chatId} for request ${requestId}`);
        } else {
          // Create a new chat if none exists
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

          console.log(`Created new chat ${chatId} for request ${requestId}`);
        }
      } else {
        chatId = request.chat_id;
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
          break;

        case 'CANCELLED':
          // Sender can cancel at any time, traveler can only cancel if PENDING
          if (isSender) {
            // Sender can cancel at any time - no restriction
          } else if (isTraveler) {
            // Traveler can only cancel if PENDING
            if (currentStatus !== 'PENDING') {
              throw new BadRequestException(
                'Traveler can only cancel PENDING requests',
              );
            }
          } else {
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

      // Update the request status
      let updatedRequest;

      // Normal update for other statuses
      updatedRequest = await this.prisma.tripRequest.update({
        where: { id: requestId },
        data: { status },
      });

      // If DELIVERED, settle wallet balances from hold to available using the payment transaction
      if (status === 'DELIVERED' && request.payment_intent_id) {
        try {
          const paymentTx = await this.prisma.transaction.findUnique({
            where: { id: request.payment_intent_id },
          });

          if (paymentTx && paymentTx.currency === 'XAF') {
            const amountPaid = paymentTx.amount_paid
              ? Number(paymentTx.amount_paid)
              : paymentTx.amount_requested
                ? Number(paymentTx.amount_requested)
                : 0;

            if (amountPaid > 0) {
              await this.prisma.$transaction(async (prisma) => {
                // Traveler's wallet
                const travelerWallet = await prisma.wallet.findUnique({
                  where: { userId: request.trip.user_id },
                });
                if (!travelerWallet) {
                  throw new NotFoundException('Traveler wallet not found');
                }

                // Convert XAF to wallet currency for generic balances
                let converted = 0;
                try {
                  const conv = this.currencyService.convertCurrency(
                    amountPaid,
                    'XAF',
                    travelerWallet.currency,
                  );
                  converted = conv.convertedAmount;
                } catch (convErr) {
                  // Proceed with XAF balances even if conversion fails
                  converted = 0;
                }

                // Move funds from hold to available (XAF and wallet currency)
                await prisma.wallet.update({
                  where: { id: travelerWallet.id },
                  data: {
                    hold_balance_xaf: { decrement: amountPaid },
                    available_balance_xaf: { increment: amountPaid },
                    ...(converted > 0
                      ? {
                          hold_balance: { decrement: converted },
                          available_balance: { increment: converted },
                        }
                      : {}),
                  },
                });

                // Mark payment transaction as COMPLETED if currently ONHOLD/SUCCESS
                await prisma.transaction.update({
                  where: { id: paymentTx.id },
                  data: { status: 'COMPLETED' },
                });
              });
            }
          }
        } catch (settleErr) {
          console.error(
            `Failed to settle wallet for delivered request ${requestId}: ${
              (settleErr as any)?.message || settleErr
            }`,
          );
        }
      }

      // Send a system message with the new status
      let systemMessage;
      try {
        console.log(
          `Attempting to send system message for request ${requestId} in chat ${chatId} with status ${status}`,
        );
        systemMessage = await this.chatGateway.sendMessageProgrammatically({
          chatId,
          senderId: userId,
          content: await this.i18n.translate(
            'translation.chat.messages.systemStatusUpdate',
            {
              lang,
              args: {
                status: status.toLowerCase(),
                newStatus: status,
              },
              defaultValue: `System: request status updated to ${status}`,
            },
          ),
          type: PrismaMessageType.SYSTEM,
          replyToId: undefined,
          imageUrl: undefined,
          requestId: request.id,
        });
        console.log(
          `Successfully sent system message ${systemMessage?.id} for request ${requestId}`,
        );
      } catch (systemMessageError) {
        console.error(
          `Failed to send system status message for request ${requestId} in chat ${chatId}:`,
          systemMessageError,
        );
        // Don't fail the entire operation, but log the error
        systemMessage = null;
      }

      // Send a message in the chat with the updated request status
      let statusMessage;
      try {
        statusMessage = await this.chatGateway.sendMessageProgrammatically({
          chatId,
          senderId: userId,
          content: await this.i18n.translate(
            'translation.chat.messages.requestStatusChanged',
            {
              lang,
              args: {
                status: status.toLowerCase(),
                requesterEmail: request.user.email,
              },
              defaultValue: `Request status changed to ${status}`,
            },
          ),
          type: PrismaMessageType.REQUEST,
          replyToId: undefined,
          imageUrl: undefined,
          requestId: request.id,
        });
      } catch (messageError) {
        console.error('Failed to send status change message:', messageError);
        statusMessage = null;
      }

      // Invalidate chat cache and user-specific cache
      try {
        await this.redis.invalidateChatCache(chatId);
        // Also invalidate cache for both users involved in the chat
        await this.redis.invalidateUserCache(userId); // Trip owner
        await this.redis.invalidateUserCache(request.user.id); // Requester
      } catch (cacheError) {
        console.error('Failed to invalidate cache:', cacheError);
      }

      // Create notification for requester about status change
      try {
        const requester = await this.prisma.user.findUnique({
          where: { id: request.user_id },
          select: {
            id: true,
            email: true,
            name: true,
            device_id: true,
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

        const notificationTitle = await this.i18n.translate(
          'translation.notification.requestStatusChanged.title',
          {
            lang,
            defaultValue: 'Request Status Updated',
          },
        );

        const notificationMessage = await this.i18n.translate(
          `translation.notification.requestStatusChanged.${status.toLowerCase()}`,
          {
            lang,
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
          },
        };

        await this.createRequestNotification(
          request.user_id,
          notificationTitle,
          notificationMessage,
          requestData,
          requester?.device_id,
        );
      } catch (notificationError) {
        console.error(
          'Failed to send notification to requester:',
          notificationError,
        );
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
        error instanceof ConflictException
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
   * Private helper method to create notification and send push notification for request events
   */
  private async createRequestNotification(
    recipientUserId: string,
    title: string,
    message: string,
    requestData: any,
    deviceId?: string,
  ): Promise<void> {
    try {
      // Create notification in database
      await this.notificationService.createNotification(
        {
          user_id: recipientUserId,
          title,
          message,
          type: 'REQUEST',
          data: requestData,
        },
        'en',
      );

      // Send push notification if user has device_id
      if (deviceId) {
        await this.notificationService.sendPushNotification({
          deviceId,
          title,
          body: message,
          data: requestData,
        });
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

      let whereClause: any = {};

      if (direction === 'INCOMING') {
        // Requests on trips created by the user
        whereClause = {
          trip: {
            user_id: userId,
          },
        };
      } else if (direction === 'OUTGOING') {
        // Requests made by the user to other people's trips
        whereClause = {
          user_id: userId,
        };
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
      });

      // Transform requests
      const transformedRequests = requests.map((request) => ({
        id: request.id,
        trip_id: request.trip_id,
        user_id: request.user_id,
        status: request.status,
        cost: request.cost ? Number(request.cost) : null,
        currency: request.currency,
        message: request.message,
        created_at: request.created_at,
        updated_at: request.updated_at,
        user: request.user,
        trip: request.trip,
        request_items: request.request_items.map((item) => ({
          trip_item_id: item.trip_item_id,
          quantity: item.quantity,
          special_notes: item.special_notes,
          trip_item: item.trip_item,
        })),
      }));

      const message = await this.i18n.translate(
        'translation.request.getUserRequests.success',
        {
          lang,
          defaultValue: 'Requests retrieved successfully',
        },
      );

      return {
        message,
        requests: transformedRequests,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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
      // Get the request with trip and user information
      const request = await this.prisma.tripRequest.findUnique({
        where: { id: requestId },
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

      // Send a REVIEW message in the chat if chat exists
      if (request.chat_id) {
        try {
          // Get the review message content
          const reviewContent = await this.i18n.translate(
            'translation.chat.messages.reviewSubmitted',
            {
              lang,
              args: {
                rating: rating.toString(),
              },
              defaultValue: `Rating submitted: ${rating}/5`,
            },
          );

          // Send review message with review_id
          await this.chatGateway.sendMessageProgrammatically({
            chatId: request.chat_id,
            senderId: userId,
            content: reviewContent,
            type: PrismaMessageType.REVIEW,
            requestId: undefined,
            reviewId: newRating.id,
          });

          // Invalidate chat cache
          await this.redis.invalidateChatCache(request.chat_id);
        } catch (messageError) {
          console.error('Failed to send review message in chat:', messageError);
          // Don't throw - rating was created successfully
        }
      }

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
}
