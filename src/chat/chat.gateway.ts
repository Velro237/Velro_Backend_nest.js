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
  ) {}

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

    const user = (client.handshake as any).user as { id: string };
    this.socketUser.set(client.id, user.id);

    // Optionally: auto-join the user to rooms for chats they are members of
    // (so they receive events automatically)
    const memberChats = await this.chatService.getChatIdsForUser(user.id);
    console.log('chats', memberChats);
    memberChats.forEach((chatId) => client.join(this.roomName(chatId)));
  }

  async handleDisconnect(client: Socket) {
    this.socketUser.delete(client.id);
  }

  roomName(chatId: string) {
    return `chat:${chatId}`;
  }

  // Client asks to join a chat
  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ) {
    const user = (client.handshake as any).user;
    const { chatId } = payload;
    // Optionally verify membership
    const isMember = await this.chatService.isUserMemberOfChat(user.id, chatId);
    if (!isMember) {
      client.emit('error', { message: 'Not a member of this chat' });
      return;
    }
    client.join(this.roomName(chatId));
    this.server.to(this.roomName(chatId)).emit('member:joined', {
      chatId,
      userId: user.id,
    });
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ) {
    const { chatId } = payload;
    client.leave(this.roomName(chatId));
    const user = (client.handshake as any).user;
    this.server.to(this.roomName(chatId)).emit('member:left', {
      chatId,
      userId: user.id,
    });
  }

  // Send message: persist then broadcast
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    const user = (client.handshake as any).user;
    console.log('user', user);
    try {
      // persist
      const message = await this.chatService.createMessage({
        chatId: data.chatId,
        senderId: user.sub,
        content: data.content,
        type: data.type ?? PrismaMessageType.TEXT,
        replyToId: data.replyToId,
        imageUrl: data.imageUrl,
      });

      // broadcast to room
      this.server.to(this.roomName(data.chatId)).emit('message:new', message);

      // Optionally: ack to sender with the saved message (id, timestamps)
      client.emit('message:ack', message);
    } catch (err) {
      console.log('err', err);
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
    const user = (client.handshake as any).user;
    this.server.to(this.roomName(payload.chatId)).emit('message:typing', {
      chatId: payload.chatId,
      userId: user.id,
      typing: payload.typing,
    });
  }

  // Read receipt
  @SubscribeMessage('message:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string; messageId: string },
  ) {
    const user = (client.handshake as any).user;
    await this.chatService.markMessageRead(
      user.id,
      payload.chatId,
      payload.messageId,
    );
    this.server.to(this.roomName(payload.chatId)).emit('message:read', {
      chatId: payload.chatId,
      userId: user.id,
      messageId: payload.messageId,
    });
  }
}
