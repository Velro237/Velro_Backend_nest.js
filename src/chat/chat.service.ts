import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
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

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async createChat(
    createChatDto: CreateChatDto,
    userId: string,
    lang?: string,
  ): Promise<CreateChatResponseDto> {
    const { name, otherUserId, tripId } = createChatDto;

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

    // Allow users to create multiple chats together (removed existing chat check)

    try {
      const chat = await this.prisma.$transaction(async (prisma) => {
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

        // Fetch the chat with members
        return await prisma.chat.findUnique({
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
      });

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
      };
    } catch (error) {
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
                price_per_kg: true,
                fullSuitcaseOnly: true,
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
              price_per_kg: Number(chat.trip.price_per_kg),
              fullSuitcaseOnly: chat.trip.fullSuitcaseOnly,
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
                    price_per_kg: true,
                    fullSuitcaseOnly: true,
                    user: {
                      select: {
                        id: true,
                        email: true,
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
            isRead: message.isRead,
            createdAt: message.createdAt,
            tripData: message.request?.trip
              ? {
                  id: message.request.trip.id,
                  pickup: message.request.trip.pickup,
                  destination: message.request.trip.destination,
                  departure_date: message.request.trip.departure_date,
                  departure_time: message.request.trip.departure_time,
                  price_per_kg: Number(message.request.trip.price_per_kg),
                  fullSuitcaseOnly: message.request.trip.fullSuitcaseOnly,
                  user: message.request.trip.user
                    ? {
                        id: message.request.trip.user.id,
                        email: message.request.trip.user.email,
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

      return {
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
  }): Promise<MessageResponseDto> {
    const { chatId, senderId, content, type, replyToId, imageUrl } = data;

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

      return {
        id: message.id,
        chatId: message.chat_id,
        sender: {
          id: message.sender.id,
          email: message.sender.email,
        },
        content: message.content,
        imageUrl: message.image_url,
        type: message.type,
        isRead: message.isRead,
        createdAt: message.createdAt,
      };
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
}
