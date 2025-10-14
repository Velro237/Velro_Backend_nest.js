import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
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

@Injectable()
export class RequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly redis: RedisService,
    private readonly walletService: WalletService,
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
      include: {
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
        // Create the trip request with calculated cost
        const request = await prisma.tripRequest.create({
          data: {
            trip_id,
            user_id: userId,
            message: requestData.message,
            status: 'PENDING',
            cost: totalCost,
          },
          select: {
            id: true,
            trip_id: true,
            user_id: true,
            status: true,
            message: true,
            cost: true,
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

        // Check if there's already a chat between these users for this trip
        let existingChat = await this.prisma.chat.findFirst({
          where: {
            trip_id: trip.id,
            members: {
              every: {
                user_id: {
                  in: [userId, trip.user_id],
                },
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

        let chatResult;
        if (existingChat) {
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

        // Send a message in the chat with the new request data
        try {
          if (existingChat) {
            console.log('Existing chat');
            console.log('Existing chat - sending message programmatically');
            // If existing chat: use ChatGateway sendMessageProgrammatically
            const requestMessage =
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
            'Failed to create message or notify chat creation:',
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
    chatId: string,
    status: any,
    userId: string,
    lang?: string,
  ): Promise<any> {
    try {
      // Find the request by ID
      const request = await this.prisma.tripRequest.findUnique({
        where: { id: requestId },
        include: {
          request_items: true,
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

      // Check if the user is the trip owner
      if (request.trip.user_id !== userId) {
        const message = await this.i18n.translate(
          'translation.trip.request.unauthorized',
          { lang },
        );
        throw new ConflictException(message);
      }

      // Check if request is currently pending
      if (request.status !== 'PENDING') {
        const message = await this.i18n.translate(
          'translation.trip.request.notPending',
          { lang },
        );
        throw new ConflictException(message);
      }

      // Update the request status
      const updatedRequest = await this.prisma.tripRequest.update({
        where: { id: requestId },
        data: { status },
      });

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

      // Check if order is approved and paid
      if (order.status !== 'APPROVED') {
        throw new BadRequestException('Order must be approved first');
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
}
