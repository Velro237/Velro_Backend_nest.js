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
import { ImageService } from '../shared/services/image.service';
import { NotificationService } from '../notification/notification.service';
import { I18nService } from 'nestjs-i18n';

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
    private readonly imageService: ImageService,
    private readonly notificationService: NotificationService,
    private readonly i18n: I18nService,
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

    // Notify all chat rooms that this user came online
    try {
      const memberChats = await this.chatService.getChatIdsForUser(user.sub);
      memberChats.forEach((chatId) => {
        // Notify OTHER users in each chat that this user came online (exclude current user)
        this.server.to(this.roomName(chatId)).emit('user:online', {
          chatId,
          userId: user.sub,
          userEmail: userExists.email,
          timestamp: new Date().toISOString(),
          message: `${userExists.email} is now online`,
        });
      });
    } catch (error) {
      console.error(
        'Failed to notify chat rooms of user online status:',
        error,
      );
      // Don't fail the connection if notification fails
    }

    // Note: Users are NOT auto-joined to chat rooms on connection.
    // They must explicitly call the 'join' event to join a specific chat room.
    // This ensures isUserInRoom only returns true when the user has explicitly joined.
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

  // Helper method to check if a user is in a chat room
  private isUserInRoom(userId: string, chatId: string): boolean {
    try {
      // Check if server is properly initialized
      if (!this.server || !this.server.sockets) {
        return false;
      }

      const roomName = this.roomName(chatId);

      // Find all sockets for this user
      const userSockets: Socket[] = [];

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

      // Find all sockets belonging to this user
      for (const [socketId, socketUserId] of this.socketUser.entries()) {
        if (socketUserId === userId) {
          const socket = sockets.get(socketId);
          if (socket && socket.connected) {
            userSockets.push(socket);
          }
        }
      }

      if (userSockets.length === 0) {
        return false;
      }

      // Check if any of the user's sockets are in the room
      for (const socket of userSockets) {
        // Check if socket is in the room using socket.rooms (Set of room names)
        if (socket.rooms && socket.rooms.has(roomName)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking if user is in room:', error);
      return false;
    }
  }

  // Helper method to notify sender when their message is read
  private notifySenderMessageRead(
    senderId: string,
    chatId: string,
    messageId: string,
    isRead: boolean,
  ): void {
    const senderSocket = this.findSocketByUserId(senderId);
    if (senderSocket) {
      senderSocket.emit('message:read-status', {
        chatId,
        messageId,
        isRead,
      });
    }
  }

  // Helper method to emit read status change event to all members in the chat room
  private emitReadStatusChange(
    chatId: string,
    messageId: string,
    isRead: boolean,
  ): void {
    // Broadcast read status change to all members in the chat room
    this.server.to(this.roomName(chatId)).emit('message:read-status-changed', {
      chatId,
      messageId,
      isRead,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update image object_ids to use message ID
   * @param imageUrls - Array of image URLs
   * @param messageId - Message ID to use as object_id
   */
  private async updateImageObjectIds(
    imageUrls: string[],
    messageId: string,
  ): Promise<void> {
    try {
      // Find images by URL and update their object_id to message ID
      await Promise.all(
        imageUrls.map(async (url) => {
          const image = await this.prisma.image.findFirst({
            where: { url },
          });
          if (image) {
            await this.prisma.image.update({
              where: { id: image.id },
              data: { object_id: messageId },
            });
          }
        }),
      );
    } catch (error) {
      console.error('Error updating image object_ids:', error);
      throw error;
    }
  }

  // Method to send message programmatically (without WebSocket client)
  async sendMessageProgrammatically(data: {
    chatId: string;
    senderId: string;
    content: string;
    type?: any;
    replyToId?: string;
    requestId?: string;
    reviewId?: string;
    messageData?: Record<string, any>;
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
        requestId: data.requestId,
        reviewId: data.reviewId,
        messageData: data.messageData,
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
            message.reviewData = {
              id: rating.id,
              rating: rating.rating,
              comment: rating.comment,
              createdAt: rating.created_at,
              updatedAt: rating.updated_at,
              giver: {
                id: rating.giver.id,
                email: rating.giver.email,
                name: rating.giver.name,
                firstName: rating.giver.firstName ?? null,
                lastName: rating.giver.lastName ?? null,
              },
              receiver: {
                id: rating.receiver.id,
                email: rating.receiver.email,
                name: rating.receiver.name,
                firstName: rating.receiver.firstName ?? null,
                lastName: rating.receiver.lastName ?? null,
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

      // Check if receivers are in the chat room
      const receiversInRoom: string[] = [];
      for (const member of chatMembers) {
        if (member.user_id !== data.senderId) {
          if (this.isUserInRoom(member.user_id, data.chatId)) {
            receiversInRoom.push(member.user_id);
            // If receiver is in room, mark message as read immediately
            try {
              await this.chatService.markMessageRead(
                member.user_id,
                data.chatId,
                message.id,
              );
              // Note: Read status is determined per-user when sending messages,
              // so we don't modify the global message.isRead here
            } catch (error) {
              console.error(
                `Failed to mark message as read for user ${member.user_id}:`,
                error,
              );
            }
          }
        }
      }

      // Determine if message is read (if any receiver is in room)
      const isReadByReceiver = receiversInRoom.length > 0;

      // Send message acknowledgement to the sender
      // Sender sees message as read only if receiver is in the chat room
      const senderSocket = this.findSocketByUserId(data.senderId);
      if (senderSocket) {
        senderSocket.emit('message:ack', {
          ...message,
          isRead: isReadByReceiver, // Sender sees it as read only if receiver is in room
        });
      }

      // Send new message notification to other users in the chat
      // The message includes all review data when type is REVIEW
      // Only users who are BOTH online AND in the room should see it as read
      for (const member of chatMembers) {
        if (member.user_id !== data.senderId) {
          // Check if THIS specific member is in the room
          const memberInRoom = this.isUserInRoom(member.user_id, data.chatId);

          const memberSocket = this.findSocketByUserId(member.user_id);
          if (memberSocket) {
            // Send message with isRead based on whether THIS member is in room
            // Only marked as read if THIS specific member is both online AND in the room
            memberSocket.emit('message:new', {
              ...message,
              isRead: memberInRoom, // Only read if THIS member is in the room
            });
          }
        }
      }

      // Notify sender if message was read by receiver in room
      if (isReadByReceiver) {
        this.notifySenderMessageRead(
          data.senderId,
          data.chatId,
          message.id,
          true,
        );
      }

      // Send push notifications to other chat members (non-blocking)
      this.sendPushNotificationToChatMembers(
        data.chatId,
        data.senderId,
        message,
      ).catch((error) => {
        console.error('Failed to send push notifications:', error);
        // Don't fail the message creation if notifications fail
      });

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
      // Update last_seen for the user when they join the chat (general, not per chat)
      await this.prisma.user.update({
        where: {
          id: user.sub,
        },
        data: {
          last_seen: new Date(),
        },
      });

      // Get chat members to identify who was already in the room
      const chatMembers = await this.chatService.getChatMembers(chatId);
      const otherMembers = chatMembers.filter(
        (member) => member.user_id !== user.sub,
      );

      // Find which members were already in the room when the new user joined
      const membersInRoom: string[] = [];
      for (const member of otherMembers) {
        if (this.isUserInRoom(member.user_id, chatId)) {
          membersInRoom.push(member.user_id);
        }
      }

      // Get all unread messages from members who were already in the room
      // BEFORE marking as read, so we can notify those senders
      const unreadMessagesFromMembersInRoom =
        await this.prisma.message.findMany({
          where: {
            chat_id: chatId,
            sender_id: { in: membersInRoom },
            isRead: false,
          },
          select: {
            id: true,
            sender_id: true,
          },
        });

      // Mark all messages from other users as read (for the joining user)
      await this.chatService.markAllMessagesAsRead(user.sub, chatId);

      // Group messages by sender and notify each sender who was in the room
      const messagesBySender = new Map<string, string[]>();
      for (const msg of unreadMessagesFromMembersInRoom) {
        if (!messagesBySender.has(msg.sender_id)) {
          messagesBySender.set(msg.sender_id, []);
        }
        messagesBySender.get(msg.sender_id)!.push(msg.id);
      }

      // Notify each sender (who was in the room) that their messages were read by the joining user
      for (const [senderId, messageIds] of messagesBySender.entries()) {
        for (const messageId of messageIds) {
          this.notifySenderMessageRead(senderId, chatId, messageId, true);
          // Emit read status change event for each message
          this.emitReadStatusChange(chatId, messageId, true);
        }
      }
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
      // Validate that at least content or images are provided
      const hasContent = data.content && data.content.trim().length > 0;
      const hasImages = data.images && data.images.length > 0;

      if (!hasContent && !hasImages) {
        client.emit('error', {
          message: 'Message must have content or at least one image',
          details: 'Either content or images must be provided',
        });
        return;
      }

      // Validate image count limit (max 10 images per message)
      const MAX_IMAGES = 10;
      if (data.images && data.images.length > MAX_IMAGES) {
        client.emit('error', {
          message: 'Too many images',
          details: `Maximum ${MAX_IMAGES} images allowed per message`,
        });
        return;
      }

      let imageUrls: string[] = [];

      // Upload images if provided
      if (data.images && data.images.length > 0) {
        try {
          // Validate base64 format and size (rough estimate: 1MB per image)
          const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image
          for (const base64Image of data.images) {
            // Check if it's a valid base64 data URL
            if (
              !base64Image.startsWith('data:image/') &&
              !base64Image.startsWith('data:application/')
            ) {
              client.emit('error', {
                message: 'Invalid image format',
                details:
                  'Images must be base64 encoded data URLs (data:image/... or data:application/...)',
              });
              return;
            }

            // Estimate size from base64 string (base64 is ~33% larger than binary)
            const base64Length = base64Image.length;
            const estimatedSize = (base64Length * 3) / 4;
            if (estimatedSize > MAX_IMAGE_SIZE_BYTES) {
              client.emit('error', {
                message: 'Image too large',
                details: `Each image must be less than ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`,
              });
              return;
            }
          }

          // Upload all images in parallel with chat ID as object_id
          const uploadPromises = data.images.map((base64Image) =>
            this.imageService.uploadImage({
              image: base64Image,
              folder: 'chat-messages',
              object_id: data.chatId, // Use chat ID as object_id
            }),
          );

          const uploadResults = await Promise.all(uploadPromises);
          imageUrls = uploadResults.map((result) => result.image.url);
        } catch (uploadError: any) {
          console.error('Failed to upload images:', uploadError);
          client.emit('error', {
            message: 'Failed to upload images',
            details:
              uploadError.message || 'An error occurred while uploading images',
          });
          return;
        }
      }

      // Prepare message data with image URLs
      const messageData: Record<string, any> = {};
      if (imageUrls.length > 0) {
        messageData.imageUrls = imageUrls;
      }

      // Determine message type:
      // 1. If explicitly set to REQUEST or PAYMENT, respect that
      // 2. If images are provided, force IMAGE type (unless it's REQUEST or PAYMENT)
      // 3. Otherwise, use provided type or default to TEXT
      let messageType: PrismaMessageType = PrismaMessageType.TEXT;

      if (data.type) {
        const providedType = data.type as PrismaMessageType;
        // Special types (REQUEST, PAYMENT) take precedence
        if (
          providedType === PrismaMessageType.REQUEST ||
          providedType === PrismaMessageType.PAYMENT
        ) {
          messageType = providedType;
        } else if (imageUrls.length > 0) {
          // If images are present, override to IMAGE (unless it's a special type)
          messageType = PrismaMessageType.IMAGE;
        } else {
          messageType = providedType;
        }
      } else {
        // No type provided: set to IMAGE if images exist, otherwise TEXT
        if (imageUrls.length > 0) {
          messageType = PrismaMessageType.IMAGE;
        }
      }

      // Normalize content: use null if not provided (schema allows nullable content)
      const content = data.content?.trim() || null;

      // Validate that we have either content or images
      if (!content && imageUrls.length === 0) {
        client.emit('error', {
          message: 'Message must have content or at least one image',
          details: 'Either content or images must be provided',
        });
        return;
      }

      // persist
      const message = await this.chatService.createMessage({
        chatId: data.chatId,
        senderId: user.sub,
        content: content,
        type: messageType,
        replyToId: data.replyToId,
        requestId: data.requestId,
        messageData:
          Object.keys(messageData).length > 0 ? messageData : undefined,
      });

      // Update images to use message ID as object_id (non-blocking)
      if (imageUrls.length > 0 && message.id) {
        // Extract image IDs from URLs (they're stored in the database)
        // We'll update them to use the message ID instead of chat ID
        this.updateImageObjectIds(imageUrls, message.id).catch((error) => {
          console.error('Failed to update image object_ids:', error);
          // Non-blocking - don't fail the message creation
        });
      }

      // Note: createMessage already extracts imageUrls from messageData and includes it in the response
      // So the message structure matches exactly what getMessages returns

      // Get chat members to check who's in the room
      const chatMembers = await this.chatService.getChatMembers(data.chatId);
      const receiversInRoom: string[] = [];

      // Check which receivers are currently in the chat room
      for (const member of chatMembers) {
        if (member.user_id !== user.sub) {
          const userInRoom = this.isUserInRoom(member.user_id, data.chatId);
          if (userInRoom) {
            receiversInRoom.push(member.user_id);
            // If receiver is in room, mark message as read immediately
            try {
              await this.chatService.markMessageRead(
                member.user_id,
                data.chatId,
                message.id,
              );
              // Emit read status change event
              this.emitReadStatusChange(data.chatId, message.id, true);
            } catch (error) {
              console.error(
                `Failed to mark message as read for user ${member.user_id}:`,
                error,
              );
            }
          }
        }
      }

      // Determine if message is read (if any receiver is in room)
      // Sender sees message as read only if at least one receiver is in the chat room
      const isReadByReceiver = receiversInRoom.length > 0;

      // Track which members we've sent individual messages to
      const membersNotified = new Set<string>();

      // Send message to each chat member individually with their specific read status
      // Only users who are BOTH online AND in the room should see it as read
      for (const member of chatMembers) {
        if (member.user_id !== user.sub) {
          // Check if THIS specific member is in the room
          const memberInRoom = this.isUserInRoom(member.user_id, data.chatId);

          // Find socket for this member
          const memberSocket = this.findSocketByUserId(member.user_id);
          if (memberSocket) {
            // Send message with isRead based on whether THIS member is in room
            // Only marked as read if THIS specific member is both online AND in the room
            memberSocket.emit('message:new', {
              ...message,
              isRead: memberInRoom, // Only read if THIS member is in the room
            });
            membersNotified.add(member.user_id);
          }
        }
      }

      // Broadcast to room so all members (including sender) receive the message
      // Individual messages above already handle read status for each receiver
      const messageForRoom = {
        ...message,
        isRead: isReadByReceiver, // For room broadcast, use aggregate read status
      };
      this.server
        .to(this.roomName(data.chatId))
        .emit('message:new', messageForRoom);

      // Ack to sender with read status based on whether receiver is in chat
      client.emit('message:ack', {
        ...message,
        isRead: isReadByReceiver, // Sender sees it as read only if receiver is in room
      });

      // Send push notifications to other chat members (non-blocking)
      this.sendPushNotificationToChatMembers(
        data.chatId,
        user.sub,
        message,
      ).catch((error) => {
        console.error('Failed to send push notifications:', error);
        // Don't fail the message creation if notifications fail
      });
    } catch (err: any) {
      console.error('Error in handleSendMessage:', err);
      client.emit('error', {
        message: 'Could not send message',
        details: err.message || 'An unexpected error occurred',
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

    // Verify message doesn't belong to sender before marking as read
    const message = await this.prisma.message.findUnique({
      where: { id: payload.messageId },
      select: { sender_id: true },
    });

    // Only mark as read if message exists and user is not the sender
    if (message && message.sender_id !== user.sub) {
      // Update last_seen when user reads a message (general, not per chat)
      try {
        await this.prisma.user.update({
          where: {
            id: user.sub,
          },
          data: {
            last_seen: new Date(),
          },
        });
      } catch (error) {
        console.error('Failed to update last_seen:', error);
        // Continue even if update fails
      }

      // Mark message as read
      await this.chatService.markMessageRead(
        user.sub,
        payload.chatId,
        payload.messageId,
      );

      // Update read status in Redis (only for receiver, not sender)
      try {
        await this.redis.setMessageReadStatus(payload.messageId, user.sub);
      } catch (error) {
        console.error('Failed to update Redis read status:', error);
        // Continue even if update fails
      }

      // Notify sender that their message was read
      this.notifySenderMessageRead(
        message.sender_id,
        payload.chatId,
        payload.messageId,
        true,
      );

      // Emit read status change event
      this.emitReadStatusChange(payload.chatId, payload.messageId, true);

      // Broadcast to room that message was read
      client.to(this.roomName(payload.chatId)).emit('message:read', {
        chatId: payload.chatId,
        userId: user.sub,
        messageId: payload.messageId,
      });
    }
    // Silently ignore if user is the sender (they can't mark their own messages as read)
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
      // Update last_seen when user marks all messages as read (general, not per chat)
      try {
        await this.prisma.user.update({
          where: {
            id: user.sub,
          },
          data: {
            last_seen: new Date(),
          },
        });
      } catch (error) {
        console.error('Failed to update last_seen:', error);
        // Continue even if update fails
      }

      // Get chat members to notify senders
      const chatMembers = await this.chatService.getChatMembers(payload.chatId);
      const otherMembers = chatMembers.filter(
        (member) => member.user_id !== user.sub,
      );

      // Get all unread messages that belong to other members before marking as read
      const unreadMessages = await this.prisma.message.findMany({
        where: {
          chat_id: payload.chatId,
          sender_id: { in: otherMembers.map((m) => m.user_id) },
          isRead: false,
        },
        select: {
          id: true,
          sender_id: true,
        },
      });

      // Mark all messages as read
      await this.chatService.markAllMessagesAsRead(user.sub, payload.chatId);

      // Notify all senders that their messages have been read
      const messagesBySender = new Map<string, string[]>();
      for (const msg of unreadMessages) {
        if (!messagesBySender.has(msg.sender_id)) {
          messagesBySender.set(msg.sender_id, []);
        }
        messagesBySender.get(msg.sender_id)!.push(msg.id);
      }

      // Notify each sender about their read messages and emit read status changes
      for (const [senderId, messageIds] of messagesBySender.entries()) {
        for (const messageId of messageIds) {
          this.notifySenderMessageRead(
            senderId,
            payload.chatId,
            messageId,
            true,
          );
          // Emit read status change event for each message
          this.emitReadStatusChange(payload.chatId, messageId, true);
        }
      }

      // Broadcast to room that all messages were read
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
      const chatMembers = await this.chatService.getChatMembers(chatId);
      const otherMembers = chatMembers.filter(
        (member) => member.user_id !== senderId,
      );

      // Get chat information to check if it's a SUPPORT chat or trip chat
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: {
          type: true,
          trip_id: true,
        },
      });

      // Get trip separately if needed (for ride trips)
      let trip = null;
      if (chat?.trip_id) {
        trip = await this.prisma.trip.findUnique({
          where: { id: chat.trip_id },
          select: {
            departure: true,
            destination: true,
            user_id: true,
            notes: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      }

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

      // Send push notification to each other member (excluding sender)
      for (const member of otherMembers) {
        try {
          // Get user's language for push notification
          const user = await this.prisma.user.findUnique({
            where: { id: member.user_id },
            select: { id: true, name: true, lang: true },
          });

          if (!user) continue;

          // Get user's language preference and normalize it
          const userLang = user.lang ? user.lang.toLowerCase().trim() : 'en';
          // Ensure it's a valid language ('en' or 'fr'), default to 'en'
          const normalizedUserLang = userLang === 'fr' ? 'fr' : 'en';

          // Translate notification title to user's language
          let notificationTitle = await this.i18n.translate(
            'translation.notification.chat.newMessage.title',
            {
              lang: normalizedUserLang,
              defaultValue: `New message from ${sender.name || sender.email}`,
              args: {
                senderName: sender.name || sender.email,
              },
            },
          );

          // Override title for ride trip chats
          if (chat?.trip_id && trip) {
            // Check if this is a ride trip (has notes with ride data)
            let rideData = null;
            if (trip.notes) {
              try {
                rideData =
                  typeof trip.notes === 'string'
                    ? JSON.parse(trip.notes)
                    : trip.notes;
              } catch (parseError) {
                // If notes is not valid JSON, treat it as regular text and skip ride trip logic
                console.warn(
                  `Failed to parse trip notes for trip ${chat.trip_id}:`,
                  parseError,
                );
              }
            }
            const isRideTrip =
              rideData &&
              (rideData.seats_available || rideData.base_price_per_seat);

            if (isRideTrip) {
              const departureLoc = trip.departure as any;
              const arrivalLoc = trip.destination as any;
              const departureName =
                departureLoc?.address || departureLoc?.city || 'Departure';
              const arrivalName =
                arrivalLoc?.address || arrivalLoc?.city || 'Arrival';
              const routeText = `${departureName} → ${arrivalName}`;
              const tripUserName =
                trip.user_id === senderId
                  ? trip.user?.name || trip.user?.email || 'Driver'
                  : sender.name || sender.email;

              notificationTitle = await this.i18n.translate(
                'translation.notification.chat.newMessage.rideTrip.title',
                {
                  lang: normalizedUserLang,
                  defaultValue: `New message from ${tripUserName} about your trip ${routeText}`,
                  args: { senderName: tripUserName, route: routeText },
                },
              );
            }
          }

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

          // Build notification data
          const notificationData: any = {
            chatId,
            messageId: message.id,
            senderId: sender.id,
            senderName: sender.name || sender.email,
            type: notificationType,
          };

          // Add ride trip info if it's a ride trip
          if (chat?.trip_id && trip) {
            let rideData = null;
            if (trip.notes) {
              try {
                rideData =
                  typeof trip.notes === 'string'
                    ? JSON.parse(trip.notes)
                    : trip.notes;
              } catch (parseError) {
                // If notes is not valid JSON, treat it as regular text and skip ride trip logic
                console.warn(
                  `Failed to parse trip notes for trip ${chat.trip_id}:`,
                  parseError,
                );
              }
            }
            const isRideTrip =
              rideData &&
              (rideData.seats_available || rideData.base_price_per_seat);

            if (isRideTrip) {
              const departureLoc = trip.departure as any;
              const arrivalLoc = trip.destination as any;
              const departureName =
                departureLoc?.address || departureLoc?.city || 'Departure';
              const arrivalName =
                arrivalLoc?.address || arrivalLoc?.city || 'Arrival';
              const routeText = `${departureName} → ${arrivalName}`;
              notificationData.trip_id = chat.trip_id;
              notificationData.route = routeText;
            }
          }

          // Send push notification using notification service method
          // This is non-blocking - sendPushNotificationToUser handles missing device_id gracefully
          // and doesn't throw errors, so we can await safely without blocking the flow
          await this.notificationService
            .sendPushNotificationToUser(
              member.user_id,
              notificationTitle,
              messageContent,
              notificationData,
              normalizedUserLang,
            )
            .catch((error) => {
              // Extra safety: catch any unexpected errors (though sendPushNotificationToUser shouldn't throw)
              console.error(
                `Unexpected error sending push notification to user ${member.user_id}:`,
                error,
              );
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
