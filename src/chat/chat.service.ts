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
    const { name, memberIds } = createChatDto;

    // Check if all member IDs exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, email: true, role: true },
    });

    if (users.length !== memberIds.length) {
      const message = await this.i18n.translate(
        'translation.chat.create.userNotFound',
        { lang },
      );
      throw new NotFoundException(message);
    }

    // Add the creator to the member list if not already included
    const allMemberIds = [...new Set([userId, ...memberIds])];

    try {
      const chat = await this.prisma.$transaction(async (prisma) => {
        // Create the chat
        const newChat = await prisma.chat.create({
          data: {
            name,
          },
        });

        // Add all members
        await prisma.chatMember.createMany({
          data: allMemberIds.map((memberId) => ({
            chat_id: newChat.id,
            user_id: memberId,
          })),
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
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.message.count({ where: { chat_id: chatId } }),
      ]);

      const messageResponses: MessageResponseDto[] = messages.map(
        (message) => ({
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
