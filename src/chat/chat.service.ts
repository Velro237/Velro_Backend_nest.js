import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
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

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly redis: RedisService,
    private readonly notificationService: NotificationService,
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
      messageImageUrl,
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
                image_url: messageImageUrl || null,
                request_id: messageRequestId || null,
              },
              include: {
                sender: {
                  select: {
                    id: true,
                    email: true,
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

  async getChats(
    userId: string,
    query: GetChatsQueryDto,
    lang?: string,
  ): Promise<GetChatsResponseDto> {
    try {
      const { page = 1, limit = 10, search } = query;
      const skip = (page - 1) * limit;

      // Try to get from cache first
      const cacheKey = `user:${userId}:chats:${page}:${limit}:${search || ''}`;
      const cachedResult = await this.redis.getChatCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const whereClause: any = {
        members: {
          some: {
            user_id: userId,
          },
        },
      };

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
                    role: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                content: true,
                createdAt: true,
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
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.chat.count({ where: whereClause }),
      ]);

      const chatSummaries: ChatSummaryDto[] = chats.map((chat) => ({
        id: chat.id,
        name: chat.name,
        lastMessage: chat.messages[0]?.content || null,
        lastMessageAt: chat.messages[0]?.createdAt || null,
        unreadCount: chat._count.messages,
        members: chat.members.map((member) => ({
          id: member.user.id,
          email: member.user.email,
          name: member.user.name,
          role: member.user.role,
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
                  }
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
                    picture: chat.request.user.picture,
                  }
                : undefined,
            }
          : undefined,
      }));

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

      // Cache the result for 5 minutes
      await this.redis.setChatCache(cacheKey, result, 300);

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
                        created_at: true,
                        updated_at: true,
                      },
                    },
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

      const messageResponses: MessageResponseDto[] = await Promise.all(
        messages.map(async (message) => {
          let content = message.content;

          // Translate content for REQUEST type messages
          if (message.type === 'REQUEST') {
            content = await this.i18n.translate(
              'translation.chat.messages.newTripRequest',
              { lang },
            );
          }

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
                    },
                  },
                  receiver: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
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

          return {
            id: message.id,
            chatId: message.chat_id,
            sender: {
              id: message.sender.id,
              email: message.sender.email,
              name: message.sender.name,
            },
            content,
            imageUrl: message.image_url,
            type: message.type,
            isRead: message.sender_id === userId ? true : message.isRead,
            createdAt: message.createdAt,
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
                        name: (message.request.trip as any).user.name,
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
                          trip_item: ti.trip_item
                            ? {
                                id: ti.trip_item.id,
                                name: ti.trip_item.name,
                                description: ti.trip_item.description,
                                image_id: ti.trip_item.image_id,
                                createdAt: ti.trip_item.created_at,
                                updatedAt: ti.trip_item.updated_at,
                              }
                            : null,
                        }),
                      )
                    : undefined,
                }
              : undefined,
            requestData: message.request
              ? {
                  id: message.request.id,
                  status: message.request.status,
                  message: message.request.message,
                  cost: message.request.cost
                    ? Number(message.request.cost)
                    : null,
                  currency: message.request.currency,
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
                            return {
                              quantity: item.quantity,
                              specialNotes: item.special_notes,
                              createdAt: item.created_at,
                              updatedAt: item.updated_at,
                              price: tripItem ? Number(tripItem.price) : null,
                              available_kg: tripItem
                                ? tripItem.avalailble_kg
                                  ? Number(tripItem.avalailble_kg)
                                  : null
                                : null,
                              tripItem: item.trip_item
                                ? {
                                    id: item.trip_item.id,
                                    name: item.trip_item.name,
                                    description: item.trip_item.description,
                                    image_id: item.trip_item.image_id,
                                    createdAt: item.trip_item.created_at,
                                    updatedAt: item.trip_item.updated_at,
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
                        picture: message.request.user.picture,
                      }
                    : undefined,
                }
              : undefined,
            reviewData,
          };
        }),
      );

      const totalPages = Math.ceil(total / limit);

      const message_text = await this.i18n.translate(
        'translation.chat.messages.success',
        { lang },
      );

      // Get chat request and trip data
      const chatData = await this.getChatWithRequestAndTripData(chatId);

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

  async createMessage(data: {
    chatId: string;
    senderId: string;
    content: string;
    type: PrismaMessageType;
    replyToId?: string;
    imageUrl?: string;
    requestId?: string;
    reviewId?: string;
  }): Promise<MessageResponseDto> {
    const {
      chatId,
      senderId,
      content,
      type,
      replyToId,
      imageUrl,
      requestId,
      reviewId,
    } = data;

    // Check if user is a member of the chat
    const isMember = await this.isUserMemberOfChat(senderId, chatId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this chat');
    }

    try {
      const message = await this.prisma.$transaction(async (prisma) => {
        // Create the message
        const newMessage = await prisma.message.create({
          data: {
            chat_id: chatId,
            sender_id: senderId,
            content,
            type,
            image_url: imageUrl,
            request_id: requestId,
            review_id: reviewId,
          },
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                name: true,
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
                      },
                    },
                    trip_items: {
                      include: {
                        trip_item: true,
                      },
                    },
                  },
                },
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
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
                },
              },
              receiver: {
                select: {
                  id: true,
                  email: true,
                  name: true,
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
          console.error(
            'Error fetching review data in createMessage:',
            reviewError,
          );
          // Continue without review data rather than failing
        }
      }

      const result = {
        id: message.id,
        chatId: message.chat_id,
        sender: {
          id: message.sender.id,
          email: message.sender.email,
          name: message.sender.name,
        },
        content: message.content,
        imageUrl: message.image_url,
        type: message.type,
        isRead: true, // Messages are always "read" by the sender
        createdAt: message.createdAt,
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
                  }
                : undefined,
            }
          : undefined,
        requestData: message.request
          ? {
              id: message.request.id,
              status: message.request.status,
              message: message.request.message,
              cost: message.request.cost ? Number(message.request.cost) : null,
              currency: message.request.currency,
              createdAt: message.request.created_at,
              updatedAt: message.request.updated_at,
              availableKgs: message.request.request_items
                ? message.request.request_items.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  )
                : 0,
              requestItems: message.request.request_items
                ? message.request.request_items.map((item) => ({
                    quantity: item.quantity,
                    specialNotes: item.special_notes,
                    tripItem: item.trip_item
                      ? {
                          id: item.trip_item.id,
                          name: item.trip_item.name,
                          description: item.trip_item.description,
                        }
                      : undefined,
                  }))
                : [],
              user: message.request.user
                ? {
                    id: message.request.user.id,
                    email: message.request.user.email,
                    name: message.request.user.name,
                    picture: message.request.user.picture,
                  }
                : undefined,
            }
          : undefined,
        reviewData,
      };

      // Invalidate cache for this chat
      await this.redis.invalidateChatCache(chatId);

      // Send push notification to other chat members (excluding sender) - non-blocking
      this.sendPushNotificationToChatMembers(chatId, senderId, message).catch(
        (error) => {
          console.error('Push notification error (non-blocking):', error);
        },
      );

      return result;
    } catch (error) {
      throw new InternalServerErrorException('Failed to create message');
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

    await this.prisma.message.updateMany({
      where: {
        id: messageId,
        chat_id: chatId,
        sender_id: { not: userId }, // Don't mark own messages as read
      },
      data: {
        isRead: true,
      },
    });
  }

  async markAllMessagesAsRead(userId: string, chatId: string): Promise<void> {
    // Check if user is a member of the chat
    const isMember = await this.isUserMemberOfChat(userId, chatId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this chat');
    }

    await this.prisma.message.updateMany({
      where: {
        chat_id: chatId,
        sender_id: { not: userId }, // Don't mark own messages as read
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
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

  async getUserById(
    userId: string,
  ): Promise<{ id: string; email: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
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
          },
        },
      },
    });

    if (!chat) {
      return null;
    }

    return {
      request: chat.request,
      trip: chat.trip,
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
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                name: true,
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

    return {
      lastMessage: chat.messages[0] || null,
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

      // Get sender information for the notification
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, name: true, email: true },
      });

      if (!sender) return;

      // Send push notification to each other member
      for (const member of otherMembers) {
        try {
          // Get user's device_id for push notification
          const user = await this.prisma.user.findUnique({
            where: { id: member.user_id },
            select: { id: true, device_id: true, name: true },
          });

          if (!user || !user.device_id) continue;

          // Send push notification

          await this.notificationService.sendPushNotification({
            deviceId: user.device_id,
            title: `New message from ${sender.name || sender.email}`,
            body: message.content || 'New message received',
            data: {
              chatId,
              messageId: message.id,
              senderId: sender.id,
              senderName: sender.name || sender.email,
              type: 'CHAT_MESSAGE',
            },
          });
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
}
