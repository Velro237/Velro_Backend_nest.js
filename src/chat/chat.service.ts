import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '../redis/redis.service';
import { CreateChatDto, CreateChatResponseDto } from './dto/create-chat.dto';
import {
  SendMessageDto,
  MessageResponseDto,
  MessageType as DtoMessageType,
} from './dto/send-message.dto';
import { MessageType as PrismaMessageType } from 'generated/prisma';
import {
  GetChatsQueryDto,
  GetChatsResponseDto,
  ChatSummaryDto,
} from './dto/get-chats.dto';
import {
  GetMessagesQueryDto,
  GetMessagesResponseDto,
} from './dto/get-messages.dto';
import { NotificationService } from '../notification/notification.service';
import { ImageService } from '../shared/services/image.service';
import { CurrencyService } from '../currency/currency.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly redis: RedisService,
    private readonly notificationService: NotificationService,
    private readonly imageService: ImageService,
    private readonly currencyService: CurrencyService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async createChat(
    createChatDto: CreateChatDto,
    userId: string,
    lang?: string,
  ): Promise<CreateChatResponseDto> {
    const {
      name,
      otherUserId,
      tripId,
      messageContent,
      messageType,
      messageReplyToId,
      messageRequestId,
    } = createChatDto;

    // Prevent users from creating a chat with themselves
    if (userId === otherUserId) {
      const message = await this.i18n.translate(
        'translation.chat.create.cannotChatWithSelf',
        { lang },
      );
      throw new ConflictException(message);
    }

    // Check if the other user exists
    const otherUser = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, email: true, role: true },
    });

    if (!otherUser) {
      const message = await this.i18n.translate(
        'translation.chat.create.userNotFound',
        { lang },
      );
      throw new NotFoundException(message);
    }

    // Check if a chat already exists for this trip with both users as members
    if (tripId) {
      const existingChat = await this.prisma.chat.findFirst({
        where: {
          trip_id: tripId,
          members: {
            some: {
              user_id: userId,
            },
          },
        },
        include: {
          members: {
            select: {
              user_id: true,
            },
          },
        },
      });

      // If chat exists and both users are members, prevent creation
      if (existingChat) {
        const memberUserIds = existingChat.members.map((m) => m.user_id);
        const bothUsersAreMembersOfChat =
          memberUserIds.includes(userId) && memberUserIds.includes(otherUserId);

        if (bothUsersAreMembersOfChat) {
          const message = await this.i18n.translate(
            'translation.chat.create.duplicateTripChat',
            { lang },
          );
          throw new ConflictException(message);
        }
      }
    }

    try {
      const { chat, lastMessage } = await this.prisma.$transaction(
        async (prisma) => {
          // Create the chat
          const newChat = await prisma.chat.create({
            data: {
              name: name || null, // Direct messages don't need names
              trip_id: tripId || null, // Link to trip if provided
            },
          });

          // Add both users as members
          await prisma.chatMember.createMany({
            data: [
              { chat_id: newChat.id, user_id: userId },
              { chat_id: newChat.id, user_id: otherUserId },
            ],
          });

          // Create the initial message only if messageContent is provided
          let initialMessage = null;
          if (messageContent) {
            initialMessage = await prisma.message.create({
              data: {
                content: messageContent,
                type: messageType
                  ? (messageType as PrismaMessageType)
                  : PrismaMessageType.TEXT,
                chat_id: newChat.id,
                sender_id: userId,
                reply_to_id: null, // Initial message in a new chat cannot be a reply
                request_id: messageRequestId || null,
              },
              include: {
                sender: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            });
          }

          // Fetch the chat with members
          const chat = await prisma.chat.findUnique({
            where: { id: newChat.id },
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                      role: true,
                    },
                  },
                },
              },
            },
          });

          return { chat, lastMessage: initialMessage };
        },
      );

      // Send push notification to other chat members (excluding sender) - non-blocking
      if (messageContent) {
        this.sendPushNotificationToChatMembers(
          chat.id,
          userId,
          lastMessage,
        ).catch((error) => {
          console.error('Push notification error (non-blocking):', error);
        });
      }

      const message = await this.i18n.translate(
        'translation.chat.create.success',
        { lang },
      );

      return {
        message,
        chat: {
          id: chat.id,
          name: chat.name,
          createdAt: chat.createdAt,
          members: chat.members.map((member) => ({
            id: member.user.id,
            email: member.user.email,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            role: member.user.role,
          })),
        },
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt,
              sender: {
                id: lastMessage.sender.id,
                email: lastMessage.sender.email,
                firstName: lastMessage.sender.firstName,
                lastName: lastMessage.sender.lastName,
              },
            }
          : null,
      };
    } catch (error) {
      console.log(error);
      const message = await this.i18n.translate(
        'translation.chat.create.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Delete all chats that have no messages
   */
  private async deleteEmptyChats(): Promise<void> {
    try {
      // Find all chats with no messages
      const emptyChats = await this.prisma.chat.findMany({
        where: {
          messages: {
            none: {},
          },
        },
        select: {
          id: true,
        },
      });

      if (emptyChats.length > 0) {
        // Delete all empty chats
        // This will cascade delete chat members due to onDelete: Cascade
        await this.prisma.chat.deleteMany({
          where: {
            id: {
              in: emptyChats.map((chat) => chat.id),
            },
          },
        });
        console.log(`Deleted ${emptyChats.length} empty chats`);
      }
    } catch (error) {
      console.error('Error deleting empty chats:', error);
      // Don't throw - this is a cleanup operation
    }
  }

  async getChats(
    userId: string,
    query: GetChatsQueryDto,
    lang?: string,
  ): Promise<GetChatsResponseDto> {
    try {
      const { page = 1, limit = 10, search } = query;
      const skip = (page - 1) * limit;

      // Update user's last_seen when they fetch their chats
      // This is done in parallel with other operations to not block the request
      this.prisma.user
        .update({
          where: { id: userId },
          data: { last_seen: new Date() },
        })
        .catch((error) => {
          console.error(
            'Failed to update last_seen when fetching chats:',
            error,
          );
        });

      // Check if user is admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      const isAdmin = user?.role === 'ADMIN';

      // Delete all chats with no messages (cleanup)
      // This runs in the background and doesn't block the request
      this.deleteEmptyChats().catch((error) => {
        console.error('Failed to delete empty chats:', error);
      });

      // Try to get from cache first
      const cacheKey = `user:${userId}:chats:${page}:${limit}:${search || ''}`;
      const cachedResult = await this.redis.getChatCacheEx(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const whereClause: any = {
        members: {
          some: {
            user_id: userId,
          },
        },
        // Only include chats that have at least one message
        messages: {
          some: {},
        },
      };

      // If admin, show only SUPPORT chats. If regular user, exclude SUPPORT chats
      if (isAdmin) {
        whereClause.type = 'SUPPORT';
      } else {
        whereClause.type = {
          not: 'SUPPORT',
        };
      }

      if (search) {
        whereClause.name = {
          contains: search,
          mode: 'insensitive',
        };
      }

      const [chats, total] = await Promise.all([
        this.prisma.chat.findMany({
          where: whereClause,
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    picture: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
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
            trip: {
              select: {
                id: true,
                pickup: true,
                departure: true,
                destination: true,
                departure_date: true,
                departure_time: true,
                currency: true,
                airline_id: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                trip_items: {
                  include: {
                    trip_item: {
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        image_id: true,
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
            request: {
              select: {
                id: true,
                status: true,
                cost: true,
                currency: true,
                created_at: true,
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
                        image_id: true,
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
            },
            _count: {
              select: {
                messages: {
                  where: {
                    isRead: false,
                    sender_id: { not: userId },
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.chat.count({ where: whereClause }),
      ]);

      const chatSummaries: ChatSummaryDto[] = chats.map((chat) => {
        const lastMsg = chat.messages[0];

        // Ensure data field is properly serialized (convert to JSON if needed)
        let messageData: Record<string, any> | null = null;
        if (lastMsg?.data) {
          try {
            // If data is already a plain object, use it directly
            // Otherwise, ensure it's JSON-serializable
            messageData =
              typeof lastMsg.data === 'object' &&
              lastMsg.data !== null &&
              !Array.isArray(lastMsg.data)
                ? (lastMsg.data as Record<string, any>)
                : null;
          } catch (e) {
            messageData = null;
          }
        }

        return {
          id: chat.id,
          name: chat.name,
          is_flagged: chat.is_flagged,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                content: lastMsg.content || null,
                type: lastMsg.type,
                imageUrls: messageData?.imageUrls || null,
                data: messageData,
                createdAt: lastMsg.createdAt,
                sender: lastMsg.sender
                  ? {
                      id: lastMsg.sender.id,
                      email: lastMsg.sender.email || '',
                      name: lastMsg.sender.name || '',
                      firstName: lastMsg.sender.firstName || null,
                      lastName: lastMsg.sender.lastName || null,
                      picture: lastMsg.sender.picture || null,
                    }
                  : null,
              }
            : null,
          lastMessageAt: lastMsg?.createdAt || null,
          unreadCount: chat._count.messages,
          members: chat.members.map((member) => ({
            id: member.user.id,
            email: member.user.email,
            name: member.user.name,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            role: member.user.role,
            picture: member.user.picture,
          })),
          createdAt: chat.createdAt,
          trip: chat.trip
            ? {
                id: chat.trip.id,
                pickup: chat.trip.pickup,
                departure: chat.trip.departure,
                destination: chat.trip.destination,
                departure_date: chat.trip.departure_date,
                departure_time: chat.trip.departure_time,
                currency: chat.trip.currency,
                airline_id: chat.trip.airline_id,
                user: chat.trip.user
                  ? {
                      id: chat.trip.user.id,
                      email: chat.trip.user.email,
                      firstName: chat.trip.user.firstName,
                      lastName: chat.trip.user.lastName,
                    }
                  : undefined,
                trip_items: (chat.trip as any).trip_items
                  ? (chat.trip as any).trip_items.map((ti: any) => ({
                      trip_item_id: ti.trip_item_id,
                      price: ti.price ? Number(ti.price) : null,
                      available_kg: ti.avalailble_kg
                        ? Number(ti.avalailble_kg)
                        : null,
                      prices: ti.prices
                        ? ti.prices.map((p: any) => ({
                            currency: p.currency,
                            price: Number(p.price),
                          }))
                        : [],
                      trip_item: ti.trip_item
                        ? {
                            ...ti.trip_item,
                            translations: ti.trip_item.translations || [],
                          }
                        : null,
                    }))
                  : undefined,
              }
            : undefined,
          request: chat.request
            ? {
                id: chat.request.id,
                status: chat.request.status,
                cost: chat.request.cost ? Number(chat.request.cost) : null,
                currency: chat.request.currency,
                created_at: chat.request.created_at,
                availableKgs: chat.request.request_items
                  ? chat.request.request_items.reduce(
                      (total, item) => total + item.quantity,
                      0,
                    )
                  : 0,
                user: chat.request.user
                  ? {
                      id: chat.request.user.id,
                      email: chat.request.user.email,
                      name: chat.request.user.name,
                      firstName: chat.request.user.firstName,
                      lastName: chat.request.user.lastName,
                      picture: chat.request.user.picture,
                    }
                  : undefined,
                requestItems: chat.request.request_items
                  ? chat.request.request_items.map((item: any) => ({
                      trip_item_id: item.trip_item_id,
                      quantity: item.quantity,
                      special_notes: item.special_notes,
                      trip_item: item.trip_item
                        ? {
                            ...item.trip_item,
                            translations: item.trip_item.translations || [],
                          }
                        : null,
                    }))
                  : undefined,
              }
            : undefined,
        };
      });

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.chat.getAll.success',
        { lang },
      );

      const result = {
        message,
        chats: chatSummaries,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      // Cache the result for 1 minute (shorter TTL for more real-time updates)
      // Cache will be invalidated when messages are read or new messages are created
      await this.redis.setChatCacheEx(cacheKey, result, 60);

      return result;
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.chat.getAll.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async getMessages(
    userId: string,
    query: GetMessagesQueryDto,
    lang?: string,
  ): Promise<GetMessagesResponseDto> {
    const { chatId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Check if user is a member of the chat
    const isMember = await this.isUserMemberOfChat(userId, chatId);
    if (!isMember) {
      const message = await this.i18n.translate(
        'translation.chat.messages.unauthorized',
        { lang },
      );
      throw new ForbiddenException(message);
    }

    // Try to get from cache first (user-specific cache)
    const cacheKey = `chat:${chatId}:messages:${userId}:${page}:${limit}`;
    const cachedResult = await this.redis.getChatCacheEx(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const [messages, total] = await Promise.all([
        this.prisma.message.findMany({
          where: { chat_id: chatId },
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
            request: {
              include: {
                trip: {
                  select: {
                    id: true,
                    pickup: true,
                    departure: true,
                    destination: true,
                    departure_date: true,
                    departure_time: true,
                    currency: true,
                    airline_id: true,
                    user: {
                      select: {
                        id: true,
                        email: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                    trip_items: {
                      include: {
                        trip_item: {
                          select: {
                            id: true,
                            name: true,
                            description: true,
                            image_id: true,
                            created_at: true,
                            updated_at: true,
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
                request_items: {
                  include: {
                    trip_item: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.message.count({ where: { chat_id: chatId } }),
      ]);

      // Get user's currency for price conversion
      let userCurrency = 'XAF';
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { currency: true },
        });
        userCurrency = (user?.currency || 'XAF').toUpperCase();
      } catch (error) {
        console.error('Error fetching user currency:', error);
      }

      // Transform messages using the same logic as createMessage
      const messageResponses: MessageResponseDto[] = await Promise.all(
        messages.map(async (message) => {
          // Fetch review data if message type is REVIEW (same as createMessage)
          let reviewData = undefined;
          if (message.type === 'REVIEW' && message.review_id) {
            try {
              const rating = await this.prisma.rating.findUnique({
                where: { id: message.review_id },
                include: {
                  giver: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                  receiver: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                  trip: {
                    select: {
                      id: true,
                      pickup: true,
                      departure: true,
                      destination: true,
                    },
                  },
                  request: {
                    select: {
                      id: true,
                      status: true,
                    },
                  },
                },
              });

              if (rating) {
                reviewData = {
                  id: rating.id,
                  rating: rating.rating,
                  comment: rating.comment,
                  createdAt: rating.created_at,
                  updatedAt: rating.updated_at,
                  giver: {
                    id: rating.giver.id,
                    email: rating.giver.email,
                    name: rating.giver.name,
                  },
                  receiver: {
                    id: rating.receiver.id,
                    email: rating.receiver.email,
                    name: rating.receiver.name,
                  },
                  trip: rating.trip
                    ? {
                        id: rating.trip.id,
                        pickup: rating.trip.pickup,
                        departure: rating.trip.departure,
                        destination: rating.trip.destination,
                      }
                    : undefined,
                  request: rating.request
                    ? {
                        id: rating.request.id,
                        status: rating.request.status,
                      }
                    : undefined,
                };
              }
            } catch (reviewError) {
              console.error('Error fetching review data:', reviewError);
              // Continue without review data rather than failing
            }
          }

          // Use exact same structure as createMessage
          return {
            id: message.id,
            chatId: message.chat_id,
            sender: {
              id: message.sender.id,
              email: message.sender.email,
              name: message.sender.name,
              firstName: message.sender.firstName,
              lastName: message.sender.lastName,
            },
            content: message.content, // Use original content, not translated
            imageUrls: (message.data as Record<string, any>)?.imageUrls || null,
            type: message.type,
            isRead: message.isRead, // Show actual read status for all users (sender sees if receiver read it)
            createdAt: message.createdAt,
            updatedAt: message.createdAt, // Message model doesn't have updatedAt, using createdAt
            data: (message.data as Record<string, any>) || null,
            tripData: message.request?.trip
              ? {
                  id: message.request.trip.id,
                  pickup: message.request.trip.pickup,
                  departure: message.request.trip.departure,
                  destination: message.request.trip.destination,
                  departure_date: message.request.trip.departure_date,
                  departure_time: message.request.trip.departure_time,
                  currency: message.request.trip.currency,
                  airline_id: message.request.trip.airline_id,
                  user: message.request.trip.user
                    ? {
                        id: message.request.trip.user.id,
                        email: message.request.trip.user.email,
                        name: message.request.trip.user.name,
                        firstName: message.request.trip.user.firstName,
                        lastName: message.request.trip.user.lastName,
                      }
                    : undefined,
                  trip_items: (message.request.trip as any).trip_items
                    ? (message.request.trip as any).trip_items.map(
                        (ti: any) => ({
                          trip_item_id: ti.trip_item_id,
                          price:
                            ti.price !== undefined ? Number(ti.price) : null,
                          available_kg:
                            ti.avalailble_kg !== undefined &&
                            ti.avalailble_kg !== null
                              ? Number(ti.avalailble_kg)
                              : null,
                          createdAt: ti.created_at,
                          updatedAt: ti.updated_at,
                          prices: ti.prices
                            ? ti.prices.map((p: any) => ({
                                currency: p.currency,
                                price: Number(p.price),
                              }))
                            : [],
                          trip_item: ti.trip_item
                            ? {
                                id: ti.trip_item.id,
                                name: ti.trip_item.name,
                                description: ti.trip_item.description,
                                image_id: ti.trip_item.image_id,
                                createdAt: ti.trip_item.created_at,
                                updatedAt: ti.trip_item.updated_at,
                                translations:
                                  (ti.trip_item as any).translations || [],
                              }
                            : null,
                        }),
                      )
                    : undefined,
                }
              : undefined,
            requestData: message.request
              ? (() => {
                  // Convert cost to user's currency
                  let cost = message.request.cost
                    ? Number(message.request.cost)
                    : null;
                  let currency: string | null = message.request.currency;

                  if (
                    cost &&
                    currency &&
                    currency.toUpperCase() !== userCurrency
                  ) {
                    try {
                      const conversion = this.currencyService.convertCurrency(
                        cost,
                        currency.toUpperCase(),
                        userCurrency,
                      );
                      cost = conversion.convertedAmount;
                      currency = userCurrency;
                    } catch (error) {
                      console.error(
                        `Failed to convert request cost for request ${message.request.id}:`,
                        error,
                      );
                      // Keep original cost and currency if conversion fails
                    }
                  } else if (currency) {
                    currency = currency.toUpperCase();
                  }

                  return {
                    id: message.request.id,
                    status: message.request.status,
                    message: message.request.message,
                    cost,
                    currency,
                    createdAt: message.request.created_at,
                    updatedAt: message.request.updated_at,
                    availableKgs: message.request.request_items
                      ? message.request.request_items.reduce(
                          (total, item) => total + item.quantity,
                          0,
                        )
                      : 0,
                    requestItems: message.request.request_items
                      ? (() => {
                          const tripItems =
                            (message.request as any).trip?.trip_items || [];
                          return message.request.request_items.map(
                            (item: any) => {
                              const tripItem = tripItems.find(
                                (ti: any) =>
                                  ti.trip_item_id === item.trip_item_id,
                              );

                              // Convert price to user's currency
                              let price = null;
                              if (tripItem) {
                                const tripCurrency = (
                                  message.request.trip?.currency || 'XAF'
                                ).toUpperCase();

                                // Try to find price in user's currency from prices array
                                if (
                                  tripItem.prices &&
                                  Array.isArray(tripItem.prices)
                                ) {
                                  const userCurrencyPrice =
                                    tripItem.prices.find(
                                      (p: any) =>
                                        p.currency?.toUpperCase() ===
                                        userCurrency,
                                    );
                                  if (userCurrencyPrice) {
                                    price = Number(userCurrencyPrice.price);
                                  } else {
                                    // Convert from trip currency to user currency
                                    const basePrice = Number(tripItem.price);
                                    if (
                                      basePrice &&
                                      tripCurrency !== userCurrency
                                    ) {
                                      try {
                                        const conversion =
                                          this.currencyService.convertCurrency(
                                            basePrice,
                                            tripCurrency,
                                            userCurrency,
                                          );
                                        price = conversion.convertedAmount;
                                      } catch (error) {
                                        console.error(
                                          `Failed to convert price for trip item ${tripItem.trip_item_id}:`,
                                          error,
                                        );
                                        price = basePrice; // Fallback to original price
                                      }
                                    } else {
                                      price = basePrice;
                                    }
                                  }
                                } else {
                                  // No prices array, convert from trip currency
                                  const basePrice = Number(tripItem.price);
                                  if (
                                    basePrice &&
                                    tripCurrency !== userCurrency
                                  ) {
                                    try {
                                      const conversion =
                                        this.currencyService.convertCurrency(
                                          basePrice,
                                          tripCurrency,
                                          userCurrency,
                                        );
                                      price = conversion.convertedAmount;
                                    } catch (error) {
                                      console.error(
                                        `Failed to convert price for trip item ${tripItem.trip_item_id}:`,
                                        error,
                                      );
                                      price = basePrice; // Fallback to original price
                                    }
                                  } else {
                                    price = basePrice;
                                  }
                                }
                              }

                              return {
                                quantity: item.quantity,
                                specialNotes: item.special_notes,
                                createdAt: item.created_at,
                                updatedAt: item.updated_at,
                                price,
                                available_kg: tripItem
                                  ? tripItem.avalailble_kg
                                    ? Number(tripItem.avalailble_kg)
                                    : null
                                  : null,
                                trip_item: item.trip_item
                                  ? {
                                      id: item.trip_item.id,
                                      name: item.trip_item.name,
                                      description: item.trip_item.description,
                                      image_id: item.trip_item.image_id,
                                      createdAt: item.trip_item.created_at,
                                      updatedAt: item.trip_item.updated_at,
                                      translations: item.trip_item.translations
                                        ? item.trip_item.translations.map(
                                            (t: any) => ({
                                              id: t.id,
                                              language: t.language,
                                              name: t.name,
                                              description: t.description,
                                            }),
                                          )
                                        : [],
                                    }
                                  : undefined,
                              };
                            },
                          );
                        })()
                      : [],
                    user: message.request.user
                      ? {
                          id: message.request.user.id,
                          email: message.request.user.email,
                          name: message.request.user.name,
                          firstName: message.request.user.firstName,
                          lastName: message.request.user.lastName,
                          picture: message.request.user.picture,
                        }
                      : undefined,
                  };
                })()
              : undefined,
            reviewData,
          };
        }),
      );

      // Calculate average response time per member
      const responseTimeMap = new Map<
        string,
        { total: number; count: number }
      >();
      const sortedMessages = [...messages].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

      let previousMessage: (typeof messages)[number] | null = null;
      for (const msg of sortedMessages) {
        if (previousMessage && previousMessage.sender_id !== msg.sender_id) {
          const delta =
            msg.createdAt.getTime() - previousMessage.createdAt.getTime();
          if (delta >= 0) {
            const entry = responseTimeMap.get(msg.sender_id) || {
              total: 0,
              count: 0,
            };
            entry.total += delta;
            entry.count += 1;
            responseTimeMap.set(msg.sender_id, entry);
          }
        }
        previousMessage = msg;
      }

      const averageResponseTimes = new Map<string, number>();
      for (const [userId, { total, count }] of responseTimeMap.entries()) {
        if (count > 0) {
          averageResponseTimes.set(userId, total / count);
        }
      }

      const totalPages = Math.ceil(total / limit);

      const message_text = await this.i18n.translate(
        'translation.chat.messages.success',
        { lang },
      );

      // Get chat request and trip data
      const chatData = await this.getChatWithRequestAndTripData(chatId);

      // Update last_seen for the current user when they get messages (general, not per chat)
      // Also mark all messages as read if user is viewing the first page (most recent messages)
      // This ensures that when a user opens a chat, all messages are marked as read
      try {
        await this.prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            last_seen: new Date(),
          },
        });

        // If user is viewing the first page (most recent messages), mark all messages as read
        // This simulates the user viewing/opening the chat
        if (page === 1) {
          // Mark all unread messages from other users as read
          const unreadCount = await this.prisma.message.count({
            where: {
              chat_id: chatId,
              sender_id: { not: userId },
              isRead: false,
            },
          });

          // Only mark as read if there are unread messages
          if (unreadCount > 0) {
            await this.prisma.message.updateMany({
              where: {
                chat_id: chatId,
                sender_id: { not: userId },
                isRead: false,
              },
              data: {
                isRead: true,
              },
            });

            // Invalidate user's chat list cache so unread count updates immediately
            try {
              await this.redis.invalidateUserCache(userId);
              // Also invalidate chat cache for this specific chat
              await this.redis.invalidateChatCache(chatId);
            } catch (cacheError) {
              console.error(
                'Failed to invalidate cache after marking messages as read:',
                cacheError,
              );
              // Continue even if cache invalidation fails
            }
          }
        }
      } catch (error) {
        console.error(
          'Failed to update last_seen or mark messages as read:',
          error,
        );
        // Continue even if update fails
      }

      // Get chat info including members with last_seen (from User, not ChatMember)
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          members: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                  picture: true,
                  role: true,
                  last_seen: true,
                },
              },
            },
          },
        },
      });

      // Get online status for all members
      const onlineStatusMap = new Map<string, boolean>();
      if (chat) {
        await Promise.all(
          chat.members.map(async (member) => {
            const isOnline = await this.redis.isUserOnline(member.user.id);
            onlineStatusMap.set(member.user.id, isOnline);
          }),
        );
      }

      const chat_info = chat
        ? {
            id: chat.id,
            name: chat.name,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            members: chat.members.map((member) => ({
              id: member.user.id,
              email: member.user.email,
              name: member.user.name,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              picture: member.user.picture,
              role: member.user.role,
              last_seen: member.user.last_seen,
              average_message_response_time: averageResponseTimes.has(
                member.user.id,
              )
                ? averageResponseTimes.get(member.user.id)! / 1000
                : null,
              isOnline: onlineStatusMap.get(member.user.id) || false,
            })),
          }
        : null;

      const result = {
        message: message_text,
        messages: messageResponses,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        chat_info,
        request: chatData?.request || null,
        trip: chatData?.trip || null,
      };

      // Cache the result for 2 minutes
      await this.redis.setChatCacheEx(cacheKey, result, 120);

      return result;
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.chat.messages.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get all chats for admin (no membership filtering)
   * NOTE: This method is read-only and does NOT affect read counts or mark messages as read
   */
  async getAllChatsForAdmin(
    query: GetChatsQueryDto,
    lang?: string,
  ): Promise<GetChatsResponseDto> {
    try {
      const { page = 1, limit = 10, search } = query;
      const skip = (page - 1) * limit;

      const whereClause: any = {
        // Only include chats that have at least one message
        messages: {
          some: {},
        },
      };

      // No membership filter for admin
      // No type filter - show all chat types
      if (search) {
        whereClause.name = {
          contains: search,
          mode: 'insensitive',
        };
      }

      const [chats, total] = await Promise.all([
        this.prisma.chat.findMany({
          where: whereClause,
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    picture: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
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
            trip: {
              select: {
                id: true,
                pickup: true,
                departure: true,
                destination: true,
                departure_date: true,
                departure_time: true,
                currency: true,
                airline_id: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                trip_items: {
                  include: {
                    trip_item: {
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        image_id: true,
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
            request: {
              select: {
                id: true,
                status: true,
                cost: true,
                currency: true,
                created_at: true,
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
                        image_id: true,
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
            },
            _count: {
              select: {
                messages: {
                  where: {
                    isRead: false,
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.chat.count({ where: whereClause }),
      ]);

      const chatSummaries: ChatSummaryDto[] = chats.map((chat) => {
        const lastMsg = chat.messages[0];

        // Ensure data field is properly serialized (convert to JSON if needed)
        let messageData: Record<string, any> | null = null;
        if (lastMsg?.data) {
          try {
            messageData =
              typeof lastMsg.data === 'object' &&
              lastMsg.data !== null &&
              !Array.isArray(lastMsg.data)
                ? (lastMsg.data as Record<string, any>)
                : null;
          } catch (e) {
            messageData = null;
          }
        }

        return {
          id: chat.id,
          name: chat.name,
          is_flagged: chat.is_flagged,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                content: lastMsg.content || null,
                type: lastMsg.type,
                imageUrls: messageData?.imageUrls || null,
                data: messageData,
                createdAt: lastMsg.createdAt,
                sender: lastMsg.sender
                  ? {
                      id: lastMsg.sender.id,
                      email: lastMsg.sender.email || '',
                      name: lastMsg.sender.name || '',
                      firstName: lastMsg.sender.firstName || null,
                      lastName: lastMsg.sender.lastName || null,
                      picture: lastMsg.sender.picture || null,
                    }
                  : null,
              }
            : null,
          lastMessageAt: lastMsg?.createdAt || null,
          unreadCount: chat._count.messages,
          members: chat.members.map((member) => ({
            id: member.user.id,
            email: member.user.email,
            name: member.user.name,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            role: member.user.role,
            picture: member.user.picture,
          })),
          createdAt: chat.createdAt,
          trip: chat.trip
            ? {
                id: chat.trip.id,
                pickup: chat.trip.pickup,
                departure: chat.trip.departure,
                destination: chat.trip.destination,
                departure_date: chat.trip.departure_date,
                departure_time: chat.trip.departure_time,
                currency: chat.trip.currency,
                airline_id: chat.trip.airline_id,
                user: chat.trip.user
                  ? {
                      id: chat.trip.user.id,
                      email: chat.trip.user.email,
                      firstName: chat.trip.user.firstName,
                      lastName: chat.trip.user.lastName,
                    }
                  : undefined,
                trip_items: (chat.trip as any).trip_items
                  ? (chat.trip as any).trip_items.map((ti: any) => ({
                      trip_item_id: ti.trip_item_id,
                      price: ti.price ? Number(ti.price) : null,
                      available_kg: ti.avalailble_kg
                        ? Number(ti.avalailble_kg)
                        : null,
                      prices: ti.prices
                        ? ti.prices.map((p: any) => ({
                            currency: p.currency,
                            price: Number(p.price),
                          }))
                        : [],
                      trip_item: ti.trip_item
                        ? {
                            ...ti.trip_item,
                            translations: ti.trip_item.translations || [],
                          }
                        : null,
                    }))
                  : undefined,
              }
            : undefined,
          request: chat.request
            ? {
                id: chat.request.id,
                status: chat.request.status,
                cost: chat.request.cost ? Number(chat.request.cost) : null,
                currency: chat.request.currency,
                created_at: chat.request.created_at,
                availableKgs: chat.request.request_items
                  ? chat.request.request_items.reduce(
                      (total, item) => total + item.quantity,
                      0,
                    )
                  : 0,
                user: chat.request.user
                  ? {
                      id: chat.request.user.id,
                      email: chat.request.user.email,
                      name: chat.request.user.name,
                      firstName: chat.request.user.firstName,
                      lastName: chat.request.user.lastName,
                      picture: chat.request.user.picture,
                    }
                  : undefined,
                requestItems: chat.request.request_items
                  ? chat.request.request_items.map((item: any) => ({
                      trip_item_id: item.trip_item_id,
                      quantity: item.quantity,
                      special_notes: item.special_notes,
                      trip_item: item.trip_item
                        ? {
                            ...item.trip_item,
                            translations: item.trip_item.translations || [],
                          }
                        : null,
                    }))
                  : undefined,
              }
            : undefined,
        };
      });

      const totalPages = Math.ceil(total / limit);

      const message = await this.i18n.translate(
        'translation.chat.getAll.success',
        { lang },
      );

      return {
        message,
        chats: chatSummaries,
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
        'translation.chat.getAll.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get all messages of a chat for admin (no membership check)
   * NOTE: This method is read-only and does NOT:
   * - Update user's last_seen
   * - Mark messages as read
   * - Invalidate cache
   * - Modify any data
   */
  async getChatMessagesForAdmin(
    query: GetMessagesQueryDto,
    lang?: string,
  ): Promise<GetMessagesResponseDto> {
    const { chatId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // No membership check for admin

    // Get admin user's currency for price conversion (if needed, otherwise use XAF)
    let userCurrency = 'XAF';
    try {
      // For admin, we can't determine a specific user, so we'll use XAF as default
      // Or you could get it from a parameter, but for now using default
      userCurrency = 'XAF';
    } catch (error) {
      console.error('Error setting user currency:', error);
    }

    try {
      const [messages, total] = await Promise.all([
        this.prisma.message.findMany({
          where: { chat_id: chatId },
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
            request: {
              include: {
                trip: {
                  select: {
                    id: true,
                    pickup: true,
                    departure: true,
                    destination: true,
                    departure_date: true,
                    departure_time: true,
                    currency: true,
                    airline_id: true,
                    user: {
                      select: {
                        id: true,
                        email: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                    trip_items: {
                      include: {
                        trip_item: {
                          select: {
                            id: true,
                            name: true,
                            description: true,
                            image_id: true,
                            created_at: true,
                            updated_at: true,
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
                request_items: {
                  include: {
                    trip_item: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.message.count({ where: { chat_id: chatId } }),
      ]);

      // Transform messages using the same logic as getMessages
      const messageResponses: MessageResponseDto[] = await Promise.all(
        messages.map(async (message) => {
          // Fetch review data if message type is REVIEW
          let reviewData = undefined;
          if (message.type === 'REVIEW' && message.review_id) {
            try {
              const rating = await this.prisma.rating.findUnique({
                where: { id: message.review_id },
                include: {
                  giver: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                  receiver: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                  trip: {
                    select: {
                      id: true,
                      pickup: true,
                      departure: true,
                      destination: true,
                    },
                  },
                  request: {
                    select: {
                      id: true,
                      status: true,
                    },
                  },
                },
              });

              if (rating) {
                reviewData = {
                  id: rating.id,
                  rating: rating.rating,
                  comment: rating.comment,
                  createdAt: rating.created_at,
                  updatedAt: rating.updated_at,
                  giver: {
                    id: rating.giver.id,
                    email: rating.giver.email,
                    name: rating.giver.name,
                  },
                  receiver: {
                    id: rating.receiver.id,
                    email: rating.receiver.email,
                    name: rating.receiver.name,
                  },
                  trip: rating.trip
                    ? {
                        id: rating.trip.id,
                        pickup: rating.trip.pickup,
                        departure: rating.trip.departure,
                        destination: rating.trip.destination,
                      }
                    : undefined,
                  request: rating.request
                    ? {
                        id: rating.request.id,
                        status: rating.request.status,
                      }
                    : undefined,
                };
              }
            } catch (reviewError) {
              console.error('Error fetching review data:', reviewError);
            }
          }

          return {
            id: message.id,
            chatId: message.chat_id,
            sender: {
              id: message.sender.id,
              email: message.sender.email,
              name: message.sender.name,
              firstName: message.sender.firstName,
              lastName: message.sender.lastName,
            },
            content: message.content,
            imageUrls: (message.data as Record<string, any>)?.imageUrls || null,
            type: message.type,
            isRead: message.isRead,
            createdAt: message.createdAt,
            updatedAt: message.createdAt,
            data: (message.data as Record<string, any>) || null,
            tripData: message.request?.trip
              ? {
                  id: message.request.trip.id,
                  pickup: message.request.trip.pickup,
                  departure: message.request.trip.departure,
                  destination: message.request.trip.destination,
                  departure_date: message.request.trip.departure_date,
                  departure_time: message.request.trip.departure_time,
                  currency: message.request.trip.currency,
                  airline_id: message.request.trip.airline_id,
                  user: message.request.trip.user
                    ? {
                        id: message.request.trip.user.id,
                        email: message.request.trip.user.email,
                        name: message.request.trip.user.name,
                        firstName: message.request.trip.user.firstName,
                        lastName: message.request.trip.user.lastName,
                      }
                    : undefined,
                  trip_items: (message.request.trip as any).trip_items
                    ? (message.request.trip as any).trip_items.map(
                        (ti: any) => ({
                          trip_item_id: ti.trip_item_id,
                          price:
                            ti.price !== undefined ? Number(ti.price) : null,
                          available_kg:
                            ti.avalailble_kg !== undefined &&
                            ti.avalailble_kg !== null
                              ? Number(ti.avalailble_kg)
                              : null,
                          createdAt: ti.created_at,
                          updatedAt: ti.updated_at,
                          prices: ti.prices
                            ? ti.prices.map((p: any) => ({
                                currency: p.currency,
                                price: Number(p.price),
                              }))
                            : [],
                          trip_item: ti.trip_item
                            ? {
                                id: ti.trip_item.id,
                                name: ti.trip_item.name,
                                description: ti.trip_item.description,
                                image_id: ti.trip_item.image_id,
                                createdAt: ti.trip_item.created_at,
                                updatedAt: ti.trip_item.updated_at,
                                translations:
                                  (ti.trip_item as any).translations || [],
                              }
                            : null,
                        }),
                      )
                    : undefined,
                }
              : undefined,
            requestData: message.request
              ? (() => {
                  // Convert cost to user's currency (for admin, using XAF as default)
                  let cost = message.request.cost
                    ? Number(message.request.cost)
                    : null;
                  let currency: string | null = message.request.currency;

                  if (
                    cost &&
                    currency &&
                    currency.toUpperCase() !== userCurrency
                  ) {
                    try {
                      const conversion = this.currencyService.convertCurrency(
                        cost,
                        currency.toUpperCase(),
                        userCurrency,
                      );
                      cost = conversion.convertedAmount;
                      currency = userCurrency;
                    } catch (error) {
                      console.error(
                        `Failed to convert request cost for request ${message.request.id}:`,
                        error,
                      );
                      // Keep original cost and currency if conversion fails
                    }
                  } else if (currency) {
                    currency = currency.toUpperCase();
                  }

                  return {
                    id: message.request.id,
                    status: message.request.status,
                    message: message.request.message,
                    cost,
                    currency,
                    createdAt: message.request.created_at,
                    updatedAt: message.request.updated_at,
                    availableKgs: message.request.request_items
                      ? message.request.request_items.reduce(
                          (total, item) => total + item.quantity,
                          0,
                        )
                      : 0,
                    requestItems: message.request.request_items
                      ? (() => {
                          const tripItems =
                            (message.request as any).trip?.trip_items || [];
                          return message.request.request_items.map(
                            (item: any) => {
                              const tripItem = tripItems.find(
                                (ti: any) =>
                                  ti.trip_item_id === item.trip_item_id,
                              );

                              // Convert price to user's currency (for admin, using XAF as default)
                              let price = null;
                              if (tripItem) {
                                const tripCurrency = (
                                  message.request.trip?.currency || 'XAF'
                                ).toUpperCase();

                                // Try to find price in user's currency from prices array
                                if (
                                  tripItem.prices &&
                                  Array.isArray(tripItem.prices)
                                ) {
                                  const userCurrencyPrice =
                                    tripItem.prices.find(
                                      (p: any) =>
                                        p.currency?.toUpperCase() ===
                                        userCurrency,
                                    );
                                  if (userCurrencyPrice) {
                                    price = Number(userCurrencyPrice.price);
                                  } else {
                                    // Convert from trip currency to user currency
                                    const basePrice = Number(tripItem.price);
                                    if (
                                      basePrice &&
                                      tripCurrency !== userCurrency
                                    ) {
                                      try {
                                        const conversion =
                                          this.currencyService.convertCurrency(
                                            basePrice,
                                            tripCurrency,
                                            userCurrency,
                                          );
                                        price = conversion.convertedAmount;
                                      } catch (error) {
                                        console.error(
                                          `Failed to convert price for trip item ${tripItem.trip_item_id}:`,
                                          error,
                                        );
                                        price = basePrice; // Fallback to original price
                                      }
                                    } else {
                                      price = basePrice;
                                    }
                                  }
                                } else {
                                  // No prices array, convert from trip currency
                                  const basePrice = Number(tripItem.price);
                                  if (
                                    basePrice &&
                                    tripCurrency !== userCurrency
                                  ) {
                                    try {
                                      const conversion =
                                        this.currencyService.convertCurrency(
                                          basePrice,
                                          tripCurrency,
                                          userCurrency,
                                        );
                                      price = conversion.convertedAmount;
                                    } catch (error) {
                                      console.error(
                                        `Failed to convert price for trip item ${tripItem.trip_item_id}:`,
                                        error,
                                      );
                                      price = basePrice; // Fallback to original price
                                    }
                                  } else {
                                    price = basePrice;
                                  }
                                }
                              }

                              return {
                                quantity: item.quantity,
                                specialNotes: item.special_notes,
                                createdAt: item.created_at,
                                updatedAt: item.updated_at,
                                price,
                                available_kg: tripItem
                                  ? tripItem.avalailble_kg
                                    ? Number(tripItem.avalailble_kg)
                                    : null
                                  : null,
                                trip_item: item.trip_item
                                  ? {
                                      id: item.trip_item.id,
                                      name: item.trip_item.name,
                                      description: item.trip_item.description,
                                      image_id: item.trip_item.image_id,
                                      createdAt: item.trip_item.created_at,
                                      updatedAt: item.trip_item.updated_at,
                                      translations: item.trip_item.translations
                                        ? item.trip_item.translations.map(
                                            (t: any) => ({
                                              id: t.id,
                                              language: t.language,
                                              name: t.name,
                                              description: t.description,
                                            }),
                                          )
                                        : [],
                                    }
                                  : undefined,
                              };
                            },
                          );
                        })()
                      : [],
                    user: message.request.user
                      ? {
                          id: message.request.user.id,
                          email: message.request.user.email,
                          name: message.request.user.name,
                          firstName: message.request.user.firstName,
                          lastName: message.request.user.lastName,
                          picture: message.request.user.picture,
                        }
                      : undefined,
                  };
                })()
              : undefined,
            reviewData,
          };
        }),
      );

      // Calculate average response time per member
      const responseTimeMap = new Map<
        string,
        { total: number; count: number }
      >();
      const sortedMessages = [...messages].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

      let previousMessage: (typeof messages)[number] | null = null;
      for (const msg of sortedMessages) {
        if (previousMessage && previousMessage.sender_id !== msg.sender_id) {
          const delta =
            msg.createdAt.getTime() - previousMessage.createdAt.getTime();
          if (delta >= 0) {
            const entry = responseTimeMap.get(msg.sender_id) || {
              total: 0,
              count: 0,
            };
            entry.total += delta;
            entry.count += 1;
            responseTimeMap.set(msg.sender_id, entry);
          }
        }
        previousMessage = msg;
      }

      const averageResponseTimes = new Map<string, number>();
      for (const [userId, { total, count }] of responseTimeMap.entries()) {
        if (count > 0) {
          averageResponseTimes.set(userId, total / count);
        }
      }

      const totalPages = Math.ceil(total / limit);

      const message_text = await this.i18n.translate(
        'translation.chat.messages.success',
        { lang },
      );

      // Get chat request and trip data
      const chatData = await this.getChatWithRequestAndTripData(chatId);

      // Get chat info including members with last_seen
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          members: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                  picture: true,
                  role: true,
                  last_seen: true,
                },
              },
            },
          },
        },
      });

      // Get online status for all members
      const onlineStatusMap = new Map<string, boolean>();
      if (chat) {
        await Promise.all(
          chat.members.map(async (member) => {
            const isOnline = await this.redis.isUserOnline(member.user.id);
            onlineStatusMap.set(member.user.id, isOnline);
          }),
        );
      }

      const chat_info = chat
        ? {
            id: chat.id,
            name: chat.name,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            members: chat.members.map((member) => ({
              id: member.user.id,
              email: member.user.email,
              name: member.user.name,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              picture: member.user.picture,
              role: member.user.role,
              last_seen: member.user.last_seen,
              average_message_response_time: averageResponseTimes.has(
                member.user.id,
              )
                ? averageResponseTimes.get(member.user.id)! / 1000
                : null,
              isOnline: onlineStatusMap.get(member.user.id) || false,
            })),
          }
        : null;

      const result = {
        message: message_text,
        messages: messageResponses,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        chat_info,
        request: chatData?.request || null,
        trip: chatData?.trip || null,
      };

      return result;
    } catch (error) {
      const message = await this.i18n.translate(
        'translation.chat.messages.failed',
        { lang },
      );
      throw new InternalServerErrorException(message);
    }
  }

  async createMessage(data: {
    chatId: string;
    senderId: string;
    content: string | null;
    type: PrismaMessageType;
    replyToId?: string;
    requestId?: string;
    reviewId?: string;
    messageData?: Record<string, any>;
  }): Promise<MessageResponseDto> {
    const {
      chatId,
      senderId,
      content,
      type,
      replyToId,
      requestId,
      reviewId,
      messageData,
    } = data;

    // Check if user is a member of the chat
    // Skip membership check for WARNING type messages (admin can send warnings to any chat)
    if (type !== PrismaMessageType.WARNING) {
      const isMember = await this.isUserMemberOfChat(senderId, chatId);
      if (!isMember) {
        throw new ForbiddenException('Not a member of this chat');
      }
    }

    try {
      const message = await this.prisma.$transaction(async (prisma) => {
        // Get chat to check for trip_id (within transaction)
        const chat = await prisma.chat.findUnique({
          where: { id: chatId },
          select: { trip_id: true },
        });

        // Create the message
        const newMessage = await prisma.message.create({
          data: {
            chat_id: chatId,
            sender_id: senderId,
            content,
            type,
            request_id: requestId || null,
            review_id: reviewId || null,
            data: messageData || null,
          },
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
            request: {
              include: {
                trip: {
                  select: {
                    id: true,
                    pickup: true,
                    departure: true,
                    destination: true,
                    departure_date: true,
                    departure_time: true,
                    currency: true,
                    airline_id: true,
                    user: {
                      select: {
                        id: true,
                        email: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                    trip_items: {
                      include: {
                        trip_item: {
                          select: {
                            id: true,
                            name: true,
                            description: true,
                            image_id: true,
                            created_at: true,
                            updated_at: true,
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
                request_items: {
                  include: {
                    trip_item: {
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        image_id: true,
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
            },
          },
        });

        // Update chat's updatedAt timestamp to bring it to the top of the list
        await prisma.chat.update({
          where: { id: chatId },
          data: {
            updatedAt: new Date(),
          },
        });

        return newMessage;
      });

      // Fetch review data if message type is REVIEW
      let reviewData = undefined;
      if (message.type === 'REVIEW' && message.review_id) {
        try {
          const rating = await this.prisma.rating.findUnique({
            where: { id: message.review_id },
            include: {
              giver: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              },
              receiver: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              },
              trip: {
                select: {
                  id: true,
                  pickup: true,
                  departure: true,
                  destination: true,
                },
              },
              request: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          });

          if (rating) {
            reviewData = {
              id: rating.id,
              rating: rating.rating,
              comment: rating.comment,
              createdAt: rating.created_at,
              updatedAt: rating.updated_at,
              giver: {
                id: rating.giver.id,
                email: rating.giver.email,
                name: rating.giver.name,
                firstName: rating.giver.firstName,
                lastName: rating.giver.lastName,
              },
              receiver: {
                id: rating.receiver.id,
                email: rating.receiver.email,
                name: rating.receiver.name,
                firstName: rating.receiver.firstName,
                lastName: rating.receiver.lastName,
              },
              trip: rating.trip
                ? {
                    id: rating.trip.id,
                    pickup: rating.trip.pickup,
                    departure: rating.trip.departure,
                    destination: rating.trip.destination,
                  }
                : undefined,
              request: rating.request
                ? {
                    id: rating.request.id,
                    status: rating.request.status,
                  }
                : undefined,
            };
          }
        } catch (reviewError) {
          console.error(
            'Error fetching review data in createMessage:',
            reviewError,
          );
          // Continue without review data rather than failing
        }
      }

      // Extract imageUrls from data if present
      const messageDataFromDb =
        ((message as any).data as Record<string, any>) || null;
      const imageUrls = messageDataFromDb?.imageUrls || null;

      // Get sender's currency for price conversion
      let senderCurrency = 'XAF';
      try {
        const sender = await this.prisma.user.findUnique({
          where: { id: senderId },
          select: { currency: true },
        });
        senderCurrency = (sender?.currency || 'XAF').toUpperCase();
      } catch (error) {
        console.error('Error fetching sender currency:', error);
      }

      const result = {
        id: message.id,
        chatId: message.chat_id,
        sender: {
          id: message.sender.id,
          email: message.sender.email,
          name: message.sender.name,
          firstName: message.sender.firstName,
          lastName: message.sender.lastName,
        },
        content: message.content,
        imageUrls: imageUrls,
        type: message.type,
        isRead: false, // New messages are unread by recipients (sender will see it as read in getMessages)
        createdAt: message.createdAt,
        updatedAt: message.createdAt, // Message model doesn't have updatedAt, using createdAt
        data: messageDataFromDb,
        tripData: message.request?.trip
          ? {
              id: message.request.trip.id,
              pickup: message.request.trip.pickup,
              departure: message.request.trip.departure,
              destination: message.request.trip.destination,
              departure_date: message.request.trip.departure_date,
              departure_time: message.request.trip.departure_time,
              currency: message.request.trip.currency,
              airline_id: message.request.trip.airline_id,
              user: message.request.trip.user
                ? {
                    id: message.request.trip.user.id,
                    email: message.request.trip.user.email,
                    name: message.request.trip.user.name,
                    firstName: message.request.trip.user.firstName,
                    lastName: message.request.trip.user.lastName,
                  }
                : undefined,
              trip_items: (message.request.trip as any).trip_items
                ? (message.request.trip as any).trip_items.map((ti: any) => ({
                    trip_item_id: ti.trip_item_id,
                    price: ti.price !== undefined ? Number(ti.price) : null,
                    available_kg:
                      ti.avalailble_kg !== undefined &&
                      ti.avalailble_kg !== null
                        ? Number(ti.avalailble_kg)
                        : null,
                    createdAt: ti.created_at,
                    updatedAt: ti.updated_at,
                    prices: ti.prices
                      ? ti.prices.map((p: any) => ({
                          currency: p.currency,
                          price: Number(p.price),
                        }))
                      : [],
                    trip_item: ti.trip_item
                      ? {
                          id: ti.trip_item.id,
                          name: ti.trip_item.name,
                          description: ti.trip_item.description,
                          image_id: ti.trip_item.image_id,
                          createdAt: ti.trip_item.created_at,
                          updatedAt: ti.trip_item.updated_at,
                          translations:
                            (ti.trip_item as any).translations || [],
                        }
                      : null,
                  }))
                : undefined,
            }
          : undefined,
        requestData: message.request
          ? (() => {
              // Convert cost to sender's currency
              let cost = message.request.cost
                ? Number(message.request.cost)
                : null;
              let currency: string | null = message.request.currency;

              if (
                cost &&
                currency &&
                currency.toUpperCase() !== senderCurrency
              ) {
                try {
                  const conversion = this.currencyService.convertCurrency(
                    cost,
                    currency.toUpperCase(),
                    senderCurrency,
                  );
                  cost = conversion.convertedAmount;
                  currency = senderCurrency;
                } catch (error) {
                  console.error(
                    `Failed to convert request cost for request ${message.request.id}:`,
                    error,
                  );
                  // Keep original cost and currency if conversion fails
                }
              } else if (currency) {
                currency = currency.toUpperCase();
              }

              return {
                id: message.request.id,
                status: message.request.status,
                message: message.request.message,
                cost,
                currency,
                createdAt: message.request.created_at,
                updatedAt: message.request.updated_at,
                availableKgs: message.request.request_items
                  ? message.request.request_items.reduce(
                      (total, item) => total + item.quantity,
                      0,
                    )
                  : 0,
                requestItems: message.request.request_items
                  ? (() => {
                      const tripItems =
                        (message.request as any).trip?.trip_items || [];
                      return message.request.request_items.map((item: any) => {
                        const tripItem = tripItems.find(
                          (ti: any) => ti.trip_item_id === item.trip_item_id,
                        );

                        // Convert price to sender's currency
                        let price = null;
                        if (tripItem) {
                          const tripCurrency = (
                            message.request.trip?.currency || 'XAF'
                          ).toUpperCase();

                          // Try to find price in sender's currency from prices array
                          if (
                            tripItem.prices &&
                            Array.isArray(tripItem.prices)
                          ) {
                            const senderCurrencyPrice = tripItem.prices.find(
                              (p: any) =>
                                p.currency?.toUpperCase() === senderCurrency,
                            );
                            if (senderCurrencyPrice) {
                              price = Number(senderCurrencyPrice.price);
                            } else {
                              // Convert from trip currency to sender currency
                              const basePrice = Number(tripItem.price);
                              if (
                                basePrice &&
                                tripCurrency !== senderCurrency
                              ) {
                                try {
                                  const conversion =
                                    this.currencyService.convertCurrency(
                                      basePrice,
                                      tripCurrency,
                                      senderCurrency,
                                    );
                                  price = conversion.convertedAmount;
                                } catch (error) {
                                  console.error(
                                    `Failed to convert price for trip item ${tripItem.trip_item_id}:`,
                                    error,
                                  );
                                  price = basePrice; // Fallback to original price
                                }
                              } else {
                                price = basePrice;
                              }
                            }
                          } else {
                            // No prices array, convert from trip currency
                            const basePrice = Number(tripItem.price);
                            if (basePrice && tripCurrency !== senderCurrency) {
                              try {
                                const conversion =
                                  this.currencyService.convertCurrency(
                                    basePrice,
                                    tripCurrency,
                                    senderCurrency,
                                  );
                                price = conversion.convertedAmount;
                              } catch (error) {
                                console.error(
                                  `Failed to convert price for trip item ${tripItem.trip_item_id}:`,
                                  error,
                                );
                                price = basePrice; // Fallback to original price
                              }
                            } else {
                              price = basePrice;
                            }
                          }
                        }

                        return {
                          quantity: item.quantity,
                          specialNotes: item.special_notes,
                          createdAt: item.created_at,
                          updatedAt: item.updated_at,
                          price,
                          available_kg: tripItem
                            ? tripItem.avalailble_kg
                              ? Number(tripItem.avalailble_kg)
                              : null
                            : null,
                          trip_item: item.trip_item
                            ? {
                                id: item.trip_item.id,
                                name: item.trip_item.name,
                                description: item.trip_item.description,
                                image_id: item.trip_item.image_id,
                                createdAt: item.trip_item.created_at,
                                updatedAt: item.trip_item.updated_at,
                                translations: item.trip_item.translations || [],
                              }
                            : undefined,
                        };
                      });
                    })()
                  : [],
                user: message.request.user
                  ? {
                      id: message.request.user.id,
                      email: message.request.user.email,
                      name: message.request.user.name,
                      firstName: message.request.user.firstName,
                      lastName: message.request.user.lastName,
                      picture: message.request.user.picture,
                    }
                  : undefined,
              };
            })()
          : undefined,
        reviewData,
      };

      // Invalidate cache for this chat
      await this.redis.invalidateChatCache(chatId);

      // Invalidate user chat lists for all chat members (so their chat lists refresh with new last message)
      // This ensures chat list shows updated last message and unread count immediately
      const chatMembers = await this.getChatMembers(chatId);
      for (const member of chatMembers) {
        try {
          await this.redis.invalidateUserCache(member.user_id);
        } catch (error) {
          console.error(
            `Failed to invalidate cache for user ${member.user_id}:`,
            error,
          );
          // Continue even if cache invalidation fails for one user
        }
      }

      // Note: Push notifications are handled by the caller (e.g., chat gateway)
      // to avoid duplicate notifications

      return result;
    } catch (error: any) {
      console.error('Error in createMessage:', error);
      // Log the actual error for debugging
      if (error?.message) {
        console.error('Error details:', error.message);
      }
      if (error?.stack) {
        console.error('Error stack:', error.stack);
      }
      throw new InternalServerErrorException(
        `Failed to create message: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async markMessageRead(
    userId: string,
    chatId: string,
    messageId: string,
  ): Promise<void> {
    // Check if user is a member of the chat
    const isMember = await this.isUserMemberOfChat(userId, chatId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this chat');
    }

    // First verify the message exists and doesn't belong to this user
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        chat_id: chatId,
        sender_id: { not: userId }, // Don't mark own messages as read
      },
    });

    // Only mark as read if message exists and doesn't belong to the user
    if (message) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          isRead: true,
        },
      });

      // Invalidate user's chat list cache so unread count updates immediately
      try {
        await this.redis.invalidateUserCache(userId);
        // Also invalidate chat cache for this specific chat
        await this.redis.invalidateChatCache(chatId);
      } catch (error) {
        console.error(
          'Failed to invalidate cache after marking message as read:',
          error,
        );
        // Continue even if cache invalidation fails
      }
    }
    // Silently ignore if message doesn't exist or belongs to user (sender viewing own message)
  }

  async markAllMessagesAsRead(userId: string, chatId: string): Promise<void> {
    // Check if user is a member of the chat
    const isMember = await this.isUserMemberOfChat(userId, chatId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this chat');
    }

    // Only mark messages as read that:
    // 1. Belong to this chat
    // 2. Were sent by OTHER users (not the current user)
    // 3. Are currently unread
    // This ensures sender's own messages are never marked as read by them
    await this.prisma.message.updateMany({
      where: {
        chat_id: chatId,
        sender_id: { not: userId }, // Critical: exclude sender's own messages
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    // Invalidate user's chat list cache so unread count updates immediately
    try {
      await this.redis.invalidateUserCache(userId);
      // Also invalidate chat cache for this specific chat
      await this.redis.invalidateChatCache(chatId);
    } catch (error) {
      console.error(
        'Failed to invalidate cache after marking all messages as read:',
        error,
      );
      // Continue even if cache invalidation fails
    }
  }

  async isUserMemberOfChat(userId: string, chatId: string): Promise<boolean> {
    const membership = await this.prisma.chatMember.findUnique({
      where: {
        user_id_chat_id: {
          user_id: userId,
          chat_id: chatId,
        },
      },
    });

    return !!membership;
  }

  async getChatIdsForUser(userId: string): Promise<string[]> {
    const memberships = await this.prisma.chatMember.findMany({
      where: { user_id: userId },
      select: { chat_id: true },
    });

    return memberships.map((membership) => membership.chat_id);
  }

  async getUserById(userId: string): Promise<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    return user;
  }

  async getChatWithRequestAndTripData(chatId: string): Promise<{
    request: any;
    trip: any;
  } | null> {
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId },
      include: {
        trip: {
          select: {
            id: true,
            pickup: true,
            departure: true,
            destination: true,
            notes: true,
            departure_date: true,
            departure_time: true,
            currency: true,
            airline_id: true,
            mode_of_transport: {
              select: {
                name: true,
              },
            },
            updatedAt: true,
            user: {
              select: {
                id: true,
                email: true,
              },
            },
            trip_items: {
              select: {
                trip_item_id: true,
                price: true,
                avalailble_kg: true,
                trip_item: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    image_id: true,
                    created_at: true,
                    updated_at: true,
                  },
                },
              },
            },
          },
        },
        request: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                picture: true,
              },
            },
            trip: {
              select: {
                id: true,
                departure: true,
                trip_items: {
                  select: {
                    trip_item_id: true,
                    price: true,
                    avalailble_kg: true,
                  },
                },
              },
            },
            request_items: {
              include: {
                trip_item: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    image_id: true,
                    created_at: true,
                    updated_at: true,
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
        },
      },
    });

    if (!chat) {
      return null;
    }

    const chatWithData = chat as any;

    // Parse ride-specific data from notes (for ride trips)
    const rideData = (() => {
      const notes = chatWithData.trip?.notes;
      if (!notes) return {};
      try {
        let parsed: any;
        if (typeof notes === 'string') {
          parsed = JSON.parse(notes);
        } else if (notes && typeof notes === 'object') {
          parsed = notes;
        } else {
          return {};
        }
        return {
          seats_available:
            parsed.seats_available !== undefined
              ? Number(parsed.seats_available)
              : undefined,
          base_price_per_seat:
            parsed.base_price_per_seat !== undefined
              ? Number(parsed.base_price_per_seat)
              : undefined,
          stops: parsed.stops || [],
          driver_message: parsed.driver_message,
          notes: parsed.notes,
        };
      } catch {
        return {};
      }
    })();

    // Derive transport mode for ride trips (CAR/AIRPLANE) and boat trips (BOAT) from transport type name
    let transportMode: string | undefined = undefined;
    if (chatWithData.trip?.mode_of_transport?.name) {
      const name = String(
        chatWithData.trip.mode_of_transport.name,
      ).toLowerCase();
      if (name.includes('airplane')) {
        transportMode = 'AIRPLANE';
      } else if (name.includes('car')) {
        transportMode = 'CAR';
      } else if (name.includes('boat')) {
        transportMode = 'BOAT';
      }
    }

    return {
      request: chatWithData.request
        ? (() => {
            const tripItems = chatWithData.request.trip?.trip_items || [];
            const requestItems =
              chatWithData.request.request_items?.map((item: any) => {
                const tripItem = tripItems.find(
                  (ti) => ti.trip_item_id === item.trip_item_id,
                );

                return {
                  trip_item_id: item.trip_item_id,
                  quantity: item.quantity,
                  special_notes: item.special_notes,
                  created_at: item.created_at,
                  updated_at: item.updated_at,
                  price:
                    tripItem?.price !== undefined
                      ? Number(tripItem.price)
                      : null,
                  available_kg:
                    tripItem?.avalailble_kg !== undefined &&
                    tripItem?.avalailble_kg !== null
                      ? Number(tripItem.avalailble_kg)
                      : null,
                  trip_item: item.trip_item
                    ? {
                        id: item.trip_item.id,
                        name: item.trip_item.name,
                        description: item.trip_item.description,
                        image_id: item.trip_item.image_id,
                        created_at: item.trip_item.created_at,
                        updated_at: item.trip_item.updated_at,
                        translations: item.trip_item.translations
                          ? item.trip_item.translations.map((t: any) => ({
                              id: t.id,
                              language: t.language,
                              name: t.name,
                              description: t.description,
                            }))
                          : [],
                      }
                    : undefined,
                };
              }) || [];

            return {
              id: chatWithData.request.id,
              status: chatWithData.request.status,
              cost: chatWithData.request.cost,
              currency: chatWithData.request.currency,
              created_at: chatWithData.request.created_at,
              updated_at: chatWithData.request.updated_at,
              departure: chatWithData.request.trip?.departure || null,
              message: chatWithData.request.message || null,
              user: chatWithData.request.user,
              availableKgs: requestItems.reduce(
                (total, item) => total + item.quantity,
                0,
              ),
              requestItems,
            };
          })()
        : null,
      trip: chatWithData.trip
        ? {
            id: chatWithData.trip.id,
            pickup: chatWithData.trip.pickup,
            departure: chatWithData.trip.departure,
            destination: chatWithData.trip.destination,
            departure_date: chatWithData.trip.departure_date,
            departure_time: chatWithData.trip.departure_time,
            currency: chatWithData.trip.currency,
            airline_id: chatWithData.trip.airline_id,
            transport_mode: transportMode,
            seats_available: rideData.seats_available,
            base_price_per_seat: rideData.base_price_per_seat,
            driver_message: rideData.driver_message,
            notes: rideData.notes,
            stops: rideData.stops,
            updated_at: chatWithData.trip.updatedAt,
            user: chatWithData.trip.user,
          }
        : null,
    };
  }

  async getChatSummary(
    chatId: string,
    userId: string,
  ): Promise<{
    lastMessage: any;
    unreadCount: number;
  } | null> {
    const chat = await this.prisma.chat.findFirst({
      where: {
        id: chatId,
        members: {
          some: {
            user_id: userId,
          },
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            image_url: true,
            data: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                sender_id: { not: userId },
              },
            },
          },
        },
      },
    });

    if (!chat) {
      return null;
    }

    const lastMsg = chat.messages[0];
    return {
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            type: lastMsg.type,
            imageUrls: (lastMsg.data as Record<string, any>)?.imageUrls || null,
            data: (lastMsg.data as Record<string, any>) || null,
            createdAt: lastMsg.createdAt,
            sender: lastMsg.sender
              ? {
                  id: lastMsg.sender.id,
                  email: lastMsg.sender.email,
                  name: lastMsg.sender.name,
                }
              : null,
          }
        : null,
      unreadCount: chat._count.messages,
    };
  }

  async getChatMembers(chatId: string): Promise<Array<{ user_id: string }>> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: {
        members: {
          select: {
            user_id: true,
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat.members;
  }

  /**
   * Send push notification to other chat members when a message is sent
   * This method is designed to be non-blocking and should be called without await
   * to ensure chat functionality is not delayed by notification failures
   */
  private async sendPushNotificationToChatMembers(
    chatId: string,
    senderId: string,
    message: any,
  ): Promise<void> {
    try {
      // Get all chat members except the sender
      const chatMembers = await this.getChatMembers(chatId);
      const otherMembers = chatMembers.filter(
        (member) => member.user_id !== senderId,
      );

      // Get chat information to check if it's a SUPPORT chat
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: { type: true },
      });

      // Get sender information for the notification
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!sender) return;

      // Determine notification type: SUPPORT if chat is SUPPORT type and sender is admin, otherwise CHAT_MESSAGE
      const notificationType =
        chat?.type === 'SUPPORT' && sender.role === 'ADMIN'
          ? 'SUPPORT'
          : 'CHAT_MESSAGE';

      // Send push notification to each other member
      for (const member of otherMembers) {
        try {
          // Get user's device_id, language, and push_notification preference for push notification
          const user = await this.prisma.user.findUnique({
            where: { id: member.user_id },
            select: {
              id: true,
              device_id: true,
              name: true,
              lang: true,
              push_notification: true,
            },
          });

          if (!user || !user.device_id || !user.push_notification) continue;

          // Get user's language preference and normalize it
          const userLang = user.lang ? user.lang.toLowerCase().trim() : 'en';
          // Ensure it's a valid language ('en' or 'fr'), default to 'en'
          const normalizedUserLang = userLang === 'fr' ? 'fr' : 'en';

          // Translate notification title and body to user's language
          const notificationTitle = await this.i18n.translate(
            'translation.notification.chat.newMessage.title',
            {
              lang: normalizedUserLang,
              defaultValue: `New message from ${sender.name || sender.email}`,
              args: {
                senderName: sender.name || sender.email,
              },
            },
          );

          // Prepare message content for notification - send message directly without translation
          let messageContent = message.content || '';
          const imageCount = message.imageUrls?.length || 0;

          // Append image count info if there are images
          if (imageCount > 0) {
            if (messageContent) {
              messageContent = `${messageContent} [${imageCount} image(s)]`;
            } else {
              messageContent = `${imageCount} image(s)`;
            }
          }

          // If still no content, use translated default message
          if (!messageContent) {
            messageContent = await this.i18n.translate(
              'translation.notification.chat.newMessage.newMessageDefault',
              {
                lang: normalizedUserLang,
                defaultValue: 'New message',
              },
            );
          }

          // Send message content directly in body (no translation)
          const notificationBody = messageContent;

          // Send push notification with user's language
          await this.notificationService.sendPushNotification(
            {
              deviceId: user.device_id,
              title: notificationTitle,
              body: notificationBody,
              data: {
                chatId,
                messageId: message.id,
                senderId: sender.id,
                senderName: sender.name || sender.email,
                type: notificationType,
              },
            },
            normalizedUserLang,
          );
        } catch (error) {
          // Log error but don't fail the message creation
          console.error(
            `Failed to send push notification to user ${member.user_id}:`,
            error,
          );
        }
      }
    } catch (error) {
      // Log error but don't fail the message creation
      console.error(
        `Failed to send push notifications for chat ${chatId}:`,
        error,
      );
    }
  }

  /**
   * Get or create support chat between user and admin
   * User can only have one support chat
   */
  async getSupportChat(
    userId: string,
    lang?: string,
  ): Promise<GetChatsResponseDto> {
    try {
      // Find existing support chat for this user
      let supportChat = await this.prisma.chat.findFirst({
        where: {
          type: 'SUPPORT',
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
                  name: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  picture: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  picture: true,
                },
              },
            },
          },
          trip: {
            select: {
              id: true,
              pickup: true,
              departure: true,
              destination: true,
              departure_date: true,
              departure_time: true,
              currency: true,
              airline_id: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          request: {
            select: {
              id: true,
              status: true,
              cost: true,
              currency: true,
              created_at: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  picture: true,
                },
              },
              request_items: {
                select: {
                  quantity: true,
                },
              },
            },
          },
          _count: {
            select: {
              messages: {
                where: {
                  isRead: false,
                  sender_id: { not: userId },
                },
              },
            },
          },
        },
      });

      // If no support chat exists, create one
      if (!supportChat) {
        // Find an admin user
        const adminUser = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true, email: true, name: true },
        });

        if (!adminUser) {
          const message = await this.i18n.translate(
            'translation.chat.support.noAdmin',
            {
              lang,
              defaultValue: 'No admin user found. Please contact support.',
            },
          );
          throw new NotFoundException(message);
        }

        // Create support chat
        supportChat = await this.prisma.chat.create({
          data: {
            type: 'SUPPORT',
            name: 'Support',
            members: {
              create: [{ user_id: userId }, { user_id: adminUser.id }],
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    picture: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
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
            trip: {
              select: {
                id: true,
                pickup: true,
                departure: true,
                destination: true,
                departure_date: true,
                departure_time: true,
                currency: true,
                airline_id: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
            request: {
              select: {
                id: true,
                status: true,
                cost: true,
                currency: true,
                created_at: true,
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
                request_items: {
                  select: {
                    quantity: true,
                  },
                },
              },
            },
            _count: {
              select: {
                messages: {
                  where: {
                    isRead: false,
                    sender_id: { not: userId },
                  },
                },
              },
            },
          },
        });

        // Invalidate cache for user chats (clear all chat-related cache for this user)
        // The cache will be refreshed on next getChats call
      }

      // Transform to ChatSummaryDto format (same as getChats)
      const lastMsg = supportChat.messages[0];
      let messageData: Record<string, any> | null = null;
      if (lastMsg?.data) {
        try {
          messageData =
            typeof lastMsg.data === 'object' &&
            lastMsg.data !== null &&
            !Array.isArray(lastMsg.data)
              ? (lastMsg.data as Record<string, any>)
              : null;
        } catch (e) {
          messageData = null;
        }
      }

      const chatSummary: ChatSummaryDto = {
        id: supportChat.id,
        name: supportChat.name,
        is_flagged: supportChat.is_flagged,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.content || null,
              type: lastMsg.type,
              imageUrls: messageData?.imageUrls || null,
              data: messageData,
              createdAt: lastMsg.createdAt,
              sender: lastMsg.sender
                ? {
                    id: lastMsg.sender.id,
                    email: lastMsg.sender.email || '',
                    name: lastMsg.sender.name || '',
                    picture: lastMsg.sender.picture || null,
                  }
                : null,
            }
          : null,
        lastMessageAt: lastMsg?.createdAt || null,
        unreadCount: supportChat._count.messages,
        members: supportChat.members.map((member) => ({
          id: member.user.id,
          email: member.user.email,
          name: member.user.name,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          role: member.user.role,
          picture: member.user.picture,
        })),
        createdAt: supportChat.createdAt,
        trip: supportChat.trip
          ? {
              id: supportChat.trip.id,
              pickup: supportChat.trip.pickup,
              departure: supportChat.trip.departure,
              destination: supportChat.trip.destination,
              departure_date: supportChat.trip.departure_date,
              departure_time: supportChat.trip.departure_time,
              currency: supportChat.trip.currency,
              airline_id: supportChat.trip.airline_id,
              user: supportChat.trip.user
                ? {
                    id: supportChat.trip.user.id,
                    email: supportChat.trip.user.email,
                  }
                : undefined,
            }
          : undefined,
        request: supportChat.request
          ? {
              id: supportChat.request.id,
              status: supportChat.request.status,
              cost: supportChat.request.cost
                ? Number(supportChat.request.cost)
                : null,
              currency: supportChat.request.currency,
              created_at: supportChat.request.created_at,
              availableKgs: supportChat.request.request_items
                ? supportChat.request.request_items.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  )
                : 0,
              user: supportChat.request.user
                ? {
                    id: supportChat.request.user.id,
                    email: supportChat.request.user.email,
                    name: supportChat.request.user.name,
                    picture: supportChat.request.user.picture,
                  }
                : undefined,
            }
          : undefined,
      };

      const message = await this.i18n.translate(
        'translation.chat.support.success',
        {
          lang,
          defaultValue: 'Support chat retrieved successfully',
        },
      );

      return {
        message,
        chats: [chatSummary],
        pagination: {
          page: 1,
          limit: 1,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.chat.support.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve support chat',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Get or create support chat between a specific user and an admin (Admin only)
   * Admin can create or get support chat with any user
   */
  async getSupportChatForAdmin(
    userId: string,
    adminId: string,
    lang?: string,
  ): Promise<GetChatsResponseDto> {
    try {
      // Verify the target user exists
      const targetUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, is_deleted: true },
      });

      if (!targetUser || targetUser.is_deleted) {
        throw new NotFoundException('User not found');
      }

      // Find existing support chat between this user and the admin
      let supportChat = await this.prisma.chat.findFirst({
        where: {
          type: 'SUPPORT',
          members: {
            some: {
              user_id: userId,
            },
          },
          AND: {
            members: {
              some: {
                user_id: adminId,
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
                  name: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  picture: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
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
          trip: {
            select: {
              id: true,
              pickup: true,
              departure: true,
              destination: true,
              departure_date: true,
              departure_time: true,
              currency: true,
              airline_id: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          request: {
            select: {
              id: true,
              status: true,
              cost: true,
              currency: true,
              created_at: true,
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
              request_items: {
                select: {
                  quantity: true,
                },
              },
            },
          },
          _count: {
            select: {
              messages: {
                where: {
                  isRead: false,
                  sender_id: { not: adminId },
                },
              },
            },
          },
        },
      });

      // If no support chat exists, create one between the user and the admin
      if (!supportChat) {
        // Create support chat
        supportChat = await this.prisma.chat.create({
          data: {
            type: 'SUPPORT',
            name: 'Support',
            members: {
              create: [{ user_id: userId }, { user_id: adminId }],
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    picture: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
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
            trip: {
              select: {
                id: true,
                pickup: true,
                departure: true,
                destination: true,
                departure_date: true,
                departure_time: true,
                currency: true,
                airline_id: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
            request: {
              select: {
                id: true,
                status: true,
                cost: true,
                currency: true,
                created_at: true,
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
                request_items: {
                  select: {
                    quantity: true,
                  },
                },
              },
            },
            _count: {
              select: {
                messages: {
                  where: {
                    isRead: false,
                    sender_id: { not: adminId },
                  },
                },
              },
            },
          },
        });

        // Invalidate cache for user chats
      }

      // Transform to ChatSummaryDto format (same as getChats)
      const lastMsg = supportChat.messages[0];
      let messageData: Record<string, any> | null = null;
      if (lastMsg?.data) {
        try {
          messageData =
            typeof lastMsg.data === 'object' &&
            lastMsg.data !== null &&
            !Array.isArray(lastMsg.data)
              ? (lastMsg.data as Record<string, any>)
              : null;
        } catch (e) {
          messageData = null;
        }
      }

      const chatSummary: ChatSummaryDto = {
        id: supportChat.id,
        name: supportChat.name,
        is_flagged: supportChat.is_flagged,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.content || null,
              type: lastMsg.type,
              imageUrls: messageData?.imageUrls || null,
              data: messageData,
              createdAt: lastMsg.createdAt,
              sender: lastMsg.sender
                ? {
                    id: lastMsg.sender.id,
                    email: lastMsg.sender.email || '',
                    name: lastMsg.sender.name || '',
                    picture: lastMsg.sender.picture || null,
                  }
                : null,
            }
          : null,
        lastMessageAt: lastMsg?.createdAt || null,
        unreadCount: supportChat._count.messages,
        members: supportChat.members.map((member) => ({
          id: member.user.id,
          email: member.user.email,
          name: member.user.name,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          role: member.user.role,
          picture: member.user.picture,
        })),
        createdAt: supportChat.createdAt,
        trip: supportChat.trip
          ? {
              id: supportChat.trip.id,
              pickup: supportChat.trip.pickup,
              departure: supportChat.trip.departure,
              destination: supportChat.trip.destination,
              departure_date: supportChat.trip.departure_date,
              departure_time: supportChat.trip.departure_time,
              currency: supportChat.trip.currency,
              airline_id: supportChat.trip.airline_id,
              user: supportChat.trip.user
                ? {
                    id: supportChat.trip.user.id,
                    email: supportChat.trip.user.email,
                  }
                : undefined,
            }
          : undefined,
        request: supportChat.request
          ? {
              id: supportChat.request.id,
              status: supportChat.request.status,
              cost: supportChat.request.cost
                ? Number(supportChat.request.cost)
                : null,
              currency: supportChat.request.currency,
              created_at: supportChat.request.created_at,
              availableKgs: supportChat.request.request_items
                ? supportChat.request.request_items.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  )
                : 0,
              user: supportChat.request.user
                ? {
                    id: supportChat.request.user.id,
                    email: supportChat.request.user.email,
                    name: supportChat.request.user.name,
                    picture: supportChat.request.user.picture,
                  }
                : undefined,
            }
          : undefined,
      };

      const message = await this.i18n.translate(
        'translation.chat.support.success',
        {
          lang,
          defaultValue: 'Support chat retrieved successfully',
        },
      );

      return {
        message,
        chats: [chatSummary],
        pagination: {
          page: 1,
          limit: 1,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = await this.i18n.translate(
        'translation.chat.support.failed',
        {
          lang,
          defaultValue: 'Failed to retrieve support chat',
        },
      );
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Send a warning message to a chat (Admin only)
   * This method is called by admin to send warning messages
   * Uses ChatGateway.sendMessageProgrammatically to send the warning (similar to system messages)
   */
  async sendWarningToChat(
    chatId: string,
    adminId: string,
    message: string,
    lang?: string,
  ): Promise<{
    id: string;
    chatId: string;
    content: string;
    type: string;
    createdAt: Date;
  }> {
    // Verify chat exists
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Send warning message using chatGateway (similar to system messages)
    const warningMessage = await this.chatGateway.sendMessageProgrammatically({
      chatId,
      senderId: adminId,
      content: message,
      type: PrismaMessageType.WARNING,
    });

    return {
      id: warningMessage.id,
      chatId: warningMessage.chatId,
      content: warningMessage.content,
      type: warningMessage.type,
      createdAt: warningMessage.createdAt,
    };
  }
}
