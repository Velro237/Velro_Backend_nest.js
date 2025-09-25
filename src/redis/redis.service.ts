import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.client = createClient({
      url: redisUrl,
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });

    await this.client.connect();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  // Chat-specific Redis operations
  async setChatCache(
    chatId: string,
    data: any,
    ttl: number = 300,
  ): Promise<void> {
    await this.client.setEx(`chat:${chatId}`, ttl, JSON.stringify(data));
  }

  async getChatCache(chatId: string): Promise<any> {
    const data = await this.client.get(`chat:${chatId}`);
    return data ? JSON.parse(data as string) : null;
  }

  async deleteChatCache(chatId: string): Promise<void> {
    await this.client.del(`chat:${chatId}`);
  }

  async setUserChatsCache(
    userId: string,
    chats: any[],
    ttl: number = 300,
  ): Promise<void> {
    await this.client.setEx(`user:${userId}:chats`, ttl, JSON.stringify(chats));
  }

  async getUserChatsCache(userId: string): Promise<any[]> {
    const data = await this.client.get(`user:${userId}:chats`);
    return data ? JSON.parse(data as string) : null;
  }

  async deleteUserChatsCache(userId: string): Promise<void> {
    await this.client.del(`user:${userId}:chats`);
  }

  async setChatMessagesCache(
    chatId: string,
    messages: any[],
    ttl: number = 300,
  ): Promise<void> {
    await this.client.setEx(
      `chat:${chatId}:messages`,
      ttl,
      JSON.stringify(messages),
    );
  }

  async getChatMessagesCache(chatId: string): Promise<any[]> {
    const data = await this.client.get(`chat:${chatId}:messages`);
    return data ? JSON.parse(data as string) : null;
  }

  async deleteChatMessagesCache(chatId: string): Promise<void> {
    await this.client.del(`chat:${chatId}:messages`);
  }

  // Real-time messaging operations
  async publishMessage(channel: string, message: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribeToChannel(
    channel: string,
    callback: (message: any) => void,
  ): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();

    await subscriber.subscribe(channel, (message) => {
      callback(JSON.parse(message));
    });
  }

  // Online users tracking
  async setUserOnline(userId: string, socketId: string): Promise<void> {
    if (!userId || !socketId) {
      throw new Error('userId and socketId are required');
    }
    await this.client.sAdd(`online:users`, userId);
    await this.client.setEx(`user:${userId}:socket`, 3600, socketId); // 1 hour TTL
  }

  async setUserOffline(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('userId is required');
    }
    await this.client.sRem(`online:users`, userId);
    await this.client.del(`user:${userId}:socket`);
  }

  async getOnlineUsers(): Promise<string[]> {
    return await this.client.sMembers(`online:users`);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }
    const result = await this.client.sIsMember(`online:users`, userId);
    return Boolean(result);
  }

  // Message read status
  async setMessageReadStatus(messageId: string, userId: string): Promise<void> {
    if (!messageId || !userId) {
      throw new Error('messageId and userId are required');
    }
    await this.client.sAdd(`message:${messageId}:read`, userId);
  }

  async getMessageReadStatus(messageId: string): Promise<string[]> {
    if (!messageId) {
      return [];
    }
    return await this.client.sMembers(`message:${messageId}:read`);
  }

  // Chat typing indicators
  async setTypingStatus(
    chatId: string,
    userId: string,
    isTyping: boolean,
  ): Promise<void> {
    if (!chatId || !userId) {
      throw new Error('chatId and userId are required');
    }
    if (isTyping) {
      await this.client.sAdd(`chat:${chatId}:typing`, userId);
      await this.client.expire(`chat:${chatId}:typing`, 10); // Auto-expire after 10 seconds
    } else {
      await this.client.sRem(`chat:${chatId}:typing`, userId);
    }
  }

  async getTypingUsers(chatId: string): Promise<string[]> {
    if (!chatId) {
      return [];
    }
    return await this.client.sMembers(`chat:${chatId}:typing`);
  }

  // Cache invalidation helpers
  async invalidateUserCache(userId: string): Promise<void> {
    const keys = await this.client.keys(`user:${userId}:*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  async invalidateChatCache(chatId: string): Promise<void> {
    const keys = await this.client.keys(`chat:${chatId}*`);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}
