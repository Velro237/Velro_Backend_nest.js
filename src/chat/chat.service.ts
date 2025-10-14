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

    // Check if a chat already exists for this trip (trip_id has unique constraint)
    if (tripId) {
      const existingChat = await this.prisma.chat.findUnique({
        where: {
          trip_id: tripId,
        },
      });

      // If chat already exists for this trip, prevent creation
      if (existingChat) {
        const message = await this.i18n.translate(
          'translation.chat.create.duplicateTripChat',
          { lang },
        );
        throw new ConflictException(message);
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

          // Create the initial message
          const initialMessage = await prisma.message.create({
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
        lastMessage: {
          id: lastMessage.id,
          content: lastMessage.content,
          type: lastMessage.type,
          createdAt: lastMessage.createdAt,
          sender: {
            id: lastMessage.sender.id,
            email: lastMessage.sender.email,
          },
        },
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
          role: member.user.role,
        })),
        createdAt: chat.createdAt,
        trip: chat.trip
          ? {
              id: chat.trip.id,
              pickup: chat.trip.pickup,
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
    const cachedResult = await this.redis.getChatCache(cacheKey);
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
              },
            },
            request: {
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
                user: {
                  select: {
                    id: true,
                    email: true,
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

          return {
            id: message.id,
            chatId: message.chat_id,
            sender: {
              id: message.sender.id,
              email: message.sender.email,
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
                  createdAt: message.request.created_at,
                  updatedAt: message.request.updated_at,
                  user: message.request.user
                    ? {
                        id: message.request.user.id,
                        email: message.request.user.email,
                      }
                    : undefined,
                }
              : undefined,
          };
        }),
      );

      const totalPages = Math.ceil(total / limit);

      const message_text = await this.i18n.translate(
        'translation.chat.messages.success',
        { lang },
      );

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
      };

      // Cache the result for 2 minutes
      await this.redis.setChatCache(cacheKey, result, 120);

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
  }): Promise<MessageResponseDto> {
    const { chatId, senderId, content, type, replyToId, imageUrl, requestId } =
      data;

    // Check if user is a member of the chat
    const isMember = await this.isUserMemberOfChat(senderId, chatId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this chat');
    }

    try {
      const message = await this.prisma.message.create({
        data: {
          chat_id: chatId,
          sender_id: senderId,
          content,
          type,
          image_url: imageUrl,
          request_id: requestId,
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
            },
          },
          request: {
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
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      const result = {
        id: message.id,
        chatId: message.chat_id,
        sender: {
          id: message.sender.id,
          email: message.sender.email,
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
              createdAt: message.request.created_at,
              updatedAt: message.request.updated_at,
              user: message.request.user
                ? {
                    id: message.request.user.id,
                    email: message.request.user.email,
                  }
                : undefined,
            }
          : undefined,
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
