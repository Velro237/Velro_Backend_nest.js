// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtWsGuard } from './guards/jwt-ws.guard';
import { UseGuards, ExecutionContext } from '@nestjs/common';
import { SendMessageDto, MessageType } from './dto/send-message.dto';
import { MessageType as PrismaMessageType } from 'generated/prisma';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*' }, // restrict in production
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // Map socketId -> userId to help with cleanup (optional)
  private socketUser = new Map<string, string>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
  }

  async handleConnection(client: Socket) {
    // Manually authenticate the connection
    const jwtGuard = new JwtWsGuard(this.jwtService, this.configService);

    // Create a mock execution context for the guard
    const mockContext = {
      switchToWs: () => ({
        getClient: () => client,
      }),
    } as ExecutionContext;

    const isAuthenticated = jwtGuard.canActivate(mockContext);

    if (!isAuthenticated) {
      client.disconnect(true);
      return;
    }

    const user = (client.handshake as any).user as {
      sub: string;
      email?: string;
    };

    // Validate that the user still exists in the database
    const userExists = await this.chatService.getUserById(user.sub);
    if (!userExists) {
      console.error(
        `Connection rejected: User ${user.sub} no longer exists in database`,
      );
      client.disconnect(true);
      return;
    }

    // Additional security: validate that email from JWT matches database
    if (user.email && user.email !== userExists.email) {
      console.error(
        `Connection rejected: Email mismatch for user ${user.sub}. JWT: ${user.email}, DB: ${userExists.email}`,
      );
      client.disconnect(true);
      return;
    }

    this.socketUser.set(client.id, user.sub);

    // Set user as online in Redis
    await this.redis.setUserOnline(user.sub, client.id);

    // Optionally: auto-join the user to rooms for chats they are members of
    // (so they receive events automatically)
    const memberChats = await this.chatService.getChatIdsForUser(user.sub);
    memberChats.forEach((chatId) => {
      client.join(this.roomName(chatId));

      // Notify OTHER users in each chat that this user came online (exclude current user)
      client.to(this.roomName(chatId)).emit('user:online', {
        chatId,
        userId: user.sub,
        userEmail: userExists.email,
        timestamp: new Date().toISOString(),
        message: `${userExists.email} is now online`,
      });
    });
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUser.get(client.id);
    if (userId) {
      // Set user as offline in Redis
      await this.redis.setUserOffline(userId);

      // Get user's chat rooms and notify others that user went offline
      try {
        const memberChats = await this.chatService.getChatIdsForUser(userId);
        memberChats.forEach((chatId) => {
          this.server.to(this.roomName(chatId)).emit('user:offline', {
            chatId,
            userId,
            timestamp: new Date().toISOString(),
            message: `User went offline`,
          });
        });
      } catch (error) {
        console.error('Failed to notify offline status:', error);
      }
    }
    this.socketUser.delete(client.id);
  }

  roomName(chatId: string) {
    return `chat:${chatId}`;
  }

  // Method to send message programmatically (without WebSocket client)
  async sendMessageProgrammatically(data: {
    chatId: string;
    senderId: string;
    content: string;
    type?: any;
    replyToId?: string;
    imageUrl?: string;
    requestId?: string;
    reviewId?: string;
  }): Promise<any> {
    try {
      // Create message using chat service
      // Note: createMessage already fetches and includes reviewData for REVIEW type messages
      const message = await this.chatService.createMessage({
        chatId: data.chatId,
        senderId: data.senderId,
        content: data.content,
        type: data.type ?? PrismaMessageType.TEXT,
        replyToId: data.replyToId,
        imageUrl: data.imageUrl,
        requestId: data.requestId,
        reviewId: data.reviewId,
      });

      // Ensure review data is included if this is a REVIEW message
      // createMessage already handles this, but we verify it's present
      if (
        data.type === PrismaMessageType.REVIEW &&
        data.reviewId &&
        !message.reviewData
      ) {
        // If reviewData is missing, fetch it explicitly
        // This is a safety check, though createMessage should already include it
        try {
          const rating = await this.prisma.rating.findUnique({
            where: { id: data.reviewId },
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
            message.reviewData = {
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
            'Error fetching review data in sendMessageProgrammatically:',
            reviewError,
          );
        }
      }

      // Get chat members to send targeted notifications
      const chatMembers = await this.chatService.getChatMembers(data.chatId);

      // Send message acknowledgement to the sender
      const senderSocket = this.findSocketByUserId(data.senderId);
      if (senderSocket) {
        senderSocket.emit('message:ack', message);
      }

      // Send new message notification to other users in the chat
      // The message includes all review data when type is REVIEW
      for (const member of chatMembers) {
        if (member.user_id !== data.senderId) {
          const memberSocket = this.findSocketByUserId(member.user_id);
          if (memberSocket) {
            memberSocket.emit('message:new', message);
          }
        }
      }

      return message;
    } catch (error) {
      console.error('Failed to send message programmatically:', error);
      throw error;
    }
  }

  // Helper method to find socket by user ID
  private findSocketByUserId(userId: string): Socket | null {
    try {
      // Check if server is properly initialized
      if (!this.server) {
        return null;
      }

      // Try different ways to access sockets based on Socket.IO version
      let sockets: Map<string, Socket>;

      if (this.server.sockets && this.server.sockets.sockets) {
        // Socket.IO v4+ API
        sockets = this.server.sockets.sockets;
      } else if (
        this.server.sockets &&
        typeof (this.server.sockets as any).sockets === 'function'
      ) {
        // Socket.IO v3 API
        sockets = (this.server.sockets as any).sockets();
      } else {
        // Fallback - try to get sockets directly
        sockets = (this.server as any).sockets || new Map();
      }

      // Find the socket for the user
      for (const [socketId, socketUserId] of this.socketUser.entries()) {
        if (socketUserId === userId) {
          const socket = sockets.get(socketId);
          if (socket && socket.connected) {
            return socket;
          }
        }
      }
    } catch (error) {
      console.error('Error finding socket by user ID:', error);
    }
    return null;
  }

  // Method to notify users when a new chat is created
  async notifyChatCreated(
    chatId: string,
    userIds: string[],
    chatName?: string,
    lastMessage?: any,
  ): Promise<void> {
    // Check if server is properly initialized
    if (!this.server || !this.server.sockets) {
      return;
    }

    try {
      // Get user information for all users
      const users = await Promise.all(
        userIds.map(async (userId) => {
          const user = await this.chatService.getUserById(userId);
          return user ? { id: user.id, email: user.email } : null;
        }),
      );

      const validUsers = users.filter((user) => user !== null);

      // Notify each user about the new chat
      for (const user of validUsers) {
        const userSocket = this.findSocketByUserId(user.id);
        if (userSocket) {
          // Get unread count for this user (excluding the initial message)
          const chatSummary = await this.chatService.getChatSummary(
            chatId,
            user.id,
          );

          // Get full chat data with request and trip information
          const chatData =
            await this.chatService.getChatWithRequestAndTripData(chatId);

          userSocket.emit('chat:created', {
            chatId,
            chatName: chatName || 'New Chat',
            members: validUsers,
            timestamp: new Date().toISOString(),
            message: `You were added to a new chat: ${chatName || 'New Chat'}`,
            lastMessage: lastMessage || null,
            unreadCount: chatSummary?.unreadCount || 0,
            request: chatData?.request || null,
            trip: chatData?.trip || null,
          });
        }
      }
    } catch (error) {
      console.error('Failed to notify chat creation:', error);
    }
  }

  // Client asks to join a chat
  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ) {
    const user = (client.handshake as any).user as {
      sub: string;
      email?: string;
    };
    const { chatId } = payload;
    // Optionally verify membership
    const isMember = await this.chatService.isUserMemberOfChat(
      user.sub,
      chatId,
    );
    if (!isMember) {
      client.emit('error', { message: 'Not a member of this chat' });
      return;
    }

    // Mark all messages as read when user joins the chat
    try {
      await this.chatService.markAllMessagesAsRead(user.sub, chatId);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }

    client.join(this.roomName(chatId));

    // Notify all OTHER users in the chat that someone joined (exclude current user)
    client.to(this.roomName(chatId)).emit('member:joined', {
      chatId,
      userId: user.sub,
      userEmail: user.email || 'Unknown',
      timestamp: new Date().toISOString(),
      message: `${user.email || 'User'} joined the chat`,
    });
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ) {
    const { chatId } = payload;
    client.leave(this.roomName(chatId));
    const user = (client.handshake as any).user as {
      sub: string;
      email?: string;
    };

    // Notify all OTHER users in the chat that someone left (exclude current user)
    client.to(this.roomName(chatId)).emit('member:left', {
      chatId,
      userId: user.sub,
      userEmail: user.email || 'Unknown',
      timestamp: new Date().toISOString(),
      message: `${user.email || 'User'} left the chat`,
    });
  }

  // Send message: persist then broadcast
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    const user = (client.handshake as any).user as {
      sub: string;
      email?: string;
    };
    try {
      // persist
      const message = await this.chatService.createMessage({
        chatId: data.chatId,
        senderId: user.sub,
        content: data.content,
        type: data.type ?? PrismaMessageType.TEXT,
        replyToId: data.replyToId,
        imageUrl: data.imageUrl,
        requestId: data.requestId,
      });

      // broadcast to room
      this.server.to(this.roomName(data.chatId)).emit('message:new', message);

      // Optionally: ack to sender with the saved message (id, timestamps)
      client.emit('message:ack', message);
    } catch (err) {
      client.emit('error', {
        message: 'Could not send message',
        details: err.message,
      });
    }
  }

  // Typing indicator
  @SubscribeMessage('message:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string; typing: boolean },
  ) {
    const user = (client.handshake as any).user as {
      sub: string;
      email?: string;
    };

    // Update typing status in Redis
    await this.redis.setTypingStatus(payload.chatId, user.sub, payload.typing);

    // Get all typing users for this chat
    const typingUsers = await this.redis.getTypingUsers(payload.chatId);

    client.to(this.roomName(payload.chatId)).emit('message:typing', {
      chatId: payload.chatId,
      userId: user.sub,
      typing: payload.typing,
      typingUsers: typingUsers.filter((id) => id !== user.sub), // Exclude current user
    });
  }

  // Read receipt
  @SubscribeMessage('message:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string; messageId: string },
  ) {
    const user = (client.handshake as any).user as {
      sub: string;
      email?: string;
    };
    await this.chatService.markMessageRead(
      user.sub,
      payload.chatId,
      payload.messageId,
    );

    // Update read status in Redis
    await this.redis.setMessageReadStatus(payload.messageId, user.sub);

    client.to(this.roomName(payload.chatId)).emit('message:read', {
      chatId: payload.chatId,
      userId: user.sub,
      messageId: payload.messageId,
    });
  }

  // Mark all messages as read
  @SubscribeMessage('messages:read-all')
  async handleReadAll(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ) {
    const user = (client.handshake as any).user as {
      sub: string;
      email?: string;
    };
    try {
      await this.chatService.markAllMessagesAsRead(user.sub, payload.chatId);
      client.to(this.roomName(payload.chatId)).emit('messages:read-all', {
        chatId: payload.chatId,
        userId: user.sub,
      });
    } catch (error) {
      client.emit('error', {
        message: 'Could not mark messages as read',
        details: error.message,
      });
    }
  }

  // Handle when a user is added to a chat
  @SubscribeMessage('user:added-to-chat')
  async handleUserAddedToChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string; userId: string },
  ) {
    const user = (client.handshake as any).user as {
      sub: string;
      email?: string;
    };

    try {
      // Verify the user is a member of the chat
      const isMember = await this.chatService.isUserMemberOfChat(
        user.sub,
        payload.chatId,
      );
      if (!isMember) {
        client.emit('error', { message: 'Not a member of this chat' });
        return;
      }

      // Get user information
      const addedUser = await this.chatService.getUserById(payload.userId);
      if (!addedUser) {
        client.emit('error', { message: 'User not found' });
        return;
      }

      // Notify all members of the chat that a user was added
      this.server.to(this.roomName(payload.chatId)).emit('user:added-to-chat', {
        chatId: payload.chatId,
        addedUser: {
          id: addedUser.id,
          email: addedUser.email,
        },
        addedBy: {
          id: user.sub,
          email: user.email || 'Unknown',
        },
        timestamp: new Date().toISOString(),
        message: `${addedUser.email} was added to the chat`,
      });

      // Also notify the added user directly if they're connected
      const addedUserSocket = this.socketUser.get(client.id);
      if (addedUserSocket === payload.userId) {
        client.emit('chat:joined', {
          chatId: payload.chatId,
          message: `You were added to the chat`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      client.emit('error', {
        message: 'Could not notify user added to chat',
        details: error.message,
      });
    }
  }
}
