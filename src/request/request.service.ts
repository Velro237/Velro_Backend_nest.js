import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { RedisService } from '../redis/redis.service';
import { MessageType as PrismaMessageType } from 'generated/prisma';
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

@Injectable()
export class RequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly redis: RedisService,
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

    // Handle request items based on trip type
    let processedRequestItems = request_items;

    if (trip.fullSuitcaseOnly) {
      // For full suitcase trips, ignore request items completely
      processedRequestItems = [];
    } else {
      // For non-full suitcase trips, validate request items are provided
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
    }

    try {
      // Create trip request with request items in a transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the trip request
        const request = await prisma.tripRequest.create({
          data: {
            trip_id,
            user_id: userId,
            message: requestData.message,
            status: 'PENDING',
          },
          select: {
            id: true,
            trip_id: true,
            user_id: true,
            status: true,
            message: true,
            created_at: true,
          },
        });

        // Create request items if provided (only for non-full suitcase trips)
        if (processedRequestItems && processedRequestItems.length > 0) {
          await prisma.tripRequestItem.createMany({
            data: processedRequestItems.map((item) => ({
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
          request_items: processedRequestItems || [],
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
          // Create new chat
          chatResult = await this.chatService.createChat(
            {
              name: chatName,
              otherUserId: trip.user_id,
              tripId: trip.id,
            },
            userId,
            lang,
          );
        }

        // Send a message in the chat with the new request data
        try {
          if (!existingChat) {
            console.log('Existing chat');
            // If existing chat: use ChatService and notify about the chat
            const requestMessage = await this.chatService.createMessage({
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

            // Notify about the existing chat
            await this.chatGateway.notifyChatCreated(
              chatResult.chat.id,
              [userId, trip.user_id],
              chatName,
            );
          } else {
            console.log('New chat');
            // If new chat: use ChatGateway sendMessageProgrammatically
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

        // Invalidate chat cache for the trip owner since they now have a new chat
        try {
          await this.redis.invalidateChatCache(chatResult.chat.id);
          // Also invalidate the trip owner's user cache to refresh their chat list
          await this.redis.invalidateUserCache(trip.user_id);
        } catch (cacheError) {
          console.error('Failed to invalidate chat cache:', cacheError);
        }
      } catch (chatError) {
        // Log the error but don't fail the request creation
        console.error('Failed to create chat/message for request:', chatError);
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
          ...result.request,
          request_items: result.request_items,
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
                price_per_kg: true,
                fullSuitcaseOnly: true,
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
          price_per_kg: Number(request.trip.price_per_kg),
          fullSuitcaseOnly: request.trip.fullSuitcaseOnly,
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
    chatId: string,
    status: any,
    userId: string,
    lang?: string,
  ): Promise<any> {
    try {
      // Find the request associated with this chat
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          trip: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!chat) {
        const message = await this.i18n.translate(
          'translation.trip.request.chatNotFound',
          { lang },
        );
        throw new NotFoundException(message);
      }

      // Check if the user is the trip owner
      if (chat.trip.user_id !== userId) {
        const message = await this.i18n.translate(
          'translation.trip.request.unauthorized',
          { lang },
        );
        throw new ConflictException(message);
      }

      // Find the request for this trip
      const request = await this.prisma.tripRequest.findFirst({
        where: {
          trip_id: chat.trip_id,
        },
        include: {
          request_items: true,
          images: true,
        },
      });

      if (!request) {
        const message = await this.i18n.translate(
          'translation.trip.request.notFound',
          { lang },
        );
        throw new NotFoundException(message);
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
        where: { id: request.id },
        data: { status },
      });

      // Create a message in the chat with the updated request data
      const statusMessage = await this.chatService.createMessage({
        chatId,
        senderId: userId,
        content: await this.i18n.translate(
          'translation.chat.messages.requestStatusChanged',
          {
            lang,
            args: {
              status: status.toLowerCase(),
              requesterEmail: request.user_id, // This should be the requester's email
            },
          },
        ),
        type: 'REQUEST' as any,
        replyToId: undefined,
        imageUrl: undefined,
        requestId: request.id,
      });

      // Invalidate chat cache
      try {
        await this.redis.invalidateChatCache(chatId);
      } catch (cacheError) {
        console.error('Failed to invalidate chat cache:', cacheError);
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
        chatMessage: {
          id: statusMessage.id,
          chatId: statusMessage.chatId,
          content: statusMessage.content,
          type: statusMessage.type,
          createdAt: statusMessage.createdAt,
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
        'translation.trip.request.statusChangeFailed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }
}
