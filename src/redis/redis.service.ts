import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private static readonly PRESENCE_TTL_SECONDS = 90;

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

  // Generic cache operations (for scraper, etc.)
  async get(key: string): Promise<string | null> {
    const val = await this.client.get(key);
    return (val as string) ?? null;
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
    return true;
  }

  async setObject<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const serialized = JSON.stringify(value);
    return this.set(key, serialized, ttl);
  }

  async getObject<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
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
  private userSocketsKey(userId: string): string {
    return `user:${userId}:sockets`;
  }

  private socketPresenceKey(socketId: string): string {
    return `socket:${socketId}:presence`;
  }

  private async pruneUserSockets(userId: string): Promise<number> {
    const socketSetKey = this.userSocketsKey(userId);
    const socketIds = await this.client.sMembers(socketSetKey);

    if (!socketIds.length) {
      await this.client.sRem(`online:users`, userId);
      await this.client.del(socketSetKey);
      return 0;
    }

    const socketKeys = socketIds.map((id) => this.socketPresenceKey(id));
    const socketValues = await this.client.mGet(socketKeys);

    const activeSocketIds: string[] = [];
    const staleSocketIds: string[] = [];

    socketIds.forEach((id, index) => {
      if (socketValues[index]) {
        activeSocketIds.push(id);
      } else {
        staleSocketIds.push(id);
      }
    });

    if (staleSocketIds.length > 0) {
      await this.client.sRem(socketSetKey, staleSocketIds);
    }

    if (!activeSocketIds.length) {
      await this.client.sRem(`online:users`, userId);
      await this.client.del(socketSetKey);
      return 0;
    }

    await this.client.sAdd(`online:users`, userId);
    return activeSocketIds.length;
  }

  async setUserOnline(userId: string, socketId: string): Promise<void> {
    if (!userId || !socketId) {
      throw new Error('userId and socketId are required');
    }
    await this.client.sAdd(`online:users`, userId);
    await this.client.sAdd(this.userSocketsKey(userId), socketId);
    await this.client.setEx(
      this.socketPresenceKey(socketId),
      RedisService.PRESENCE_TTL_SECONDS,
      userId,
    );
  }

  async refreshUserOnline(userId: string, socketId: string): Promise<void> {
    if (!userId || !socketId) {
      throw new Error('userId and socketId are required');
    }
    await this.client.sAdd(`online:users`, userId);
    await this.client.sAdd(this.userSocketsKey(userId), socketId);
    await this.client.setEx(
      this.socketPresenceKey(socketId),
      RedisService.PRESENCE_TTL_SECONDS,
      userId,
    );
  }

  async setUserOffline(userId: string, socketId?: string): Promise<void> {
    if (!userId) {
      throw new Error('userId is required');
    }

    const socketSetKey = this.userSocketsKey(userId);

    if (socketId) {
      await this.client.del(this.socketPresenceKey(socketId));
      await this.client.sRem(socketSetKey, socketId);
      await this.pruneUserSockets(userId);
      return;
    }

    const socketIds = await this.client.sMembers(socketSetKey);
    if (socketIds.length > 0) {
      await this.client.del(socketIds.map((id) => this.socketPresenceKey(id)));
    }
    await this.client.del(socketSetKey);
    await this.client.sRem(`online:users`, userId);
  }

  async getOnlineUsers(): Promise<string[]> {
    try {
      const userIds = await this.client.sMembers(`online:users`);
      if (!userIds.length) {
        return [];
      }

      const statuses = await Promise.all(
        userIds.map((id) => this.isUserOnline(id)),
      );
      return userIds.filter((_, index) => statuses[index]);
    } catch (error) {
      console.error('Failed to get online users:', error);
      return [];
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    try {
      const activeSockets = await this.pruneUserSockets(userId);
      return activeSockets > 0;
    } catch (error) {
      console.error(`Failed to check online status for user ${userId}:`, error);
      return false;
    }
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
    try {
      // Use SCAN instead of KEYS for better performance in production
      // KEYS can block Redis, but for small datasets it's fine
      const keys = await this.client.keys(`user:${userId}:*`);
      if (keys.length > 0) {
        // Delete keys in batches if there are many
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await this.client.del(batch);
        }
      }
    } catch (error) {
      console.error(`Failed to invalidate user cache for ${userId}:`, error);
      throw error;
    }
  }

  async invalidateChatCache(chatId: string): Promise<void> {
    try {
      const keys = await this.client.keys(`chat:${chatId}*`);
      if (keys.length > 0) {
        // Delete keys in batches if there are many
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await this.client.del(batch);
        }
      }
    } catch (error) {
      console.error(`Failed to invalidate chat cache for ${chatId}:`, error);
      throw error;
    }
  }

  // Extended chat cache methods that accept full key
  async setChatCacheEx(
    key: string,
    data: any,
    ttl: number = 300,
  ): Promise<void> {
    await this.client.setEx(key, ttl, JSON.stringify(data));
  }

  async getChatCacheEx(key: string): Promise<any> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data as string) : null;
  }
}

