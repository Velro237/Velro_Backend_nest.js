import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateChatDto, CreateChatResponseDto } from './dto/create-chat.dto';
import { GetChatsQueryDto, GetChatsResponseDto } from './dto/get-chats.dto';
import {
  GetMessagesQueryDto,
  GetMessagesResponseDto,
} from './dto/get-messages.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';
import { I18nLang } from 'nestjs-i18n';
import {
  ApiCreateChat,
  ApiGetChats,
  ApiGetMessages,
  ApiSendMessage,
} from './decorators/api-docs.decorator';
import { SendMessageDto, MessageResponseDto } from './dto/send-message.dto';
import { ImageService } from '../shared/services/image.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessageType as PrismaMessageType } from 'generated/prisma';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly imageService: ImageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateChat()
  async createChat(
    @Body() createChatDto: CreateChatDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CreateChatResponseDto> {
    const result = await this.chatService.createChat(
      createChatDto,
      user.id,
      lang,
    );

    // Notify users about the new chat only if it has a message (not empty)
    if (result.lastMessage) {
      await this.chatGateway.notifyChatCreated(
        result.chat.id,
        [user.id, createChatDto.otherUserId],
        result.chat.name || 'New Chat',
        result.lastMessage,
      );
    }

    return result;
  }

  @Get()
  @ApiGetChats()
  async getChats(
    @Query() query: GetChatsQueryDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetChatsResponseDto> {
    return this.chatService.getChats(user.id, query, lang);
  }

  @Get('messages')
  @ApiGetMessages()
  async getMessages(
    @Query() query: GetMessagesQueryDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetMessagesResponseDto> {
    return this.chatService.getMessages(user.id, query, lang);
  }

  @Get('support')
  @ApiOperation({
    summary: 'Get or create support chat',
    description:
      'Get the support chat between the authenticated user and an admin. If no support chat exists, one will be created automatically. Returns the same format as getChats but only for the support chat.',
  })
  @ApiResponse({
    status: 200,
    description: 'Support chat retrieved successfully',
    type: GetChatsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No admin user found',
  })
  async getSupportChat(
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<GetChatsResponseDto> {
    return this.chatService.getSupportChat(user.id, lang);
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiSendMessage()
  async sendMessage(
    @Body() sendMessageDto: SendMessageDto,
    @CurrentUser() user: User,
  ): Promise<MessageResponseDto> {
    // Validate that at least content or images are provided
    const hasContent =
      sendMessageDto.content && sendMessageDto.content.trim().length > 0;
    const hasImages = sendMessageDto.images && sendMessageDto.images.length > 0;

    if (!hasContent && !hasImages) {
      throw new BadRequestException(
        'Message must have content or at least one image',
      );
    }

    // Validate image count limit (max 10 images per message)
    const MAX_IMAGES = 10;
    if (sendMessageDto.images && sendMessageDto.images.length > MAX_IMAGES) {
      throw new BadRequestException(
        `Maximum ${MAX_IMAGES} images allowed per message`,
      );
    }

    let imageUrls: string[] = [];

    // Upload images if provided
    if (sendMessageDto.images && sendMessageDto.images.length > 0) {
      // Validate base64 format and size (rough estimate: 5MB per image)
      const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image
      for (const base64Image of sendMessageDto.images) {
        // Check if it's a valid base64 data URL
        if (
          !base64Image.startsWith('data:image/') &&
          !base64Image.startsWith('data:application/')
        ) {
          throw new BadRequestException(
            'Images must be base64 encoded data URLs (data:image/... or data:application/...)',
          );
        }

        // Estimate size from base64 string (base64 is ~33% larger than binary)
        const base64Length = base64Image.length;
        const estimatedSize = (base64Length * 3) / 4;
        if (estimatedSize > MAX_IMAGE_SIZE_BYTES) {
          throw new BadRequestException(
            `Each image must be less than ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`,
          );
        }
      }

      // Upload all images in parallel with chat ID as object_id
      const uploadPromises = sendMessageDto.images.map((base64Image) =>
        this.imageService.uploadImage({
          image: base64Image,
          folder: 'chat-messages',
          object_id: sendMessageDto.chatId, // Use chat ID as object_id
        }),
      );

      const uploadResults = await Promise.all(uploadPromises);
      imageUrls = uploadResults.map((result) => result.image.url);
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

    if (sendMessageDto.type) {
      const providedType = sendMessageDto.type as PrismaMessageType;
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
    const content = sendMessageDto.content?.trim() || null;

    // Validate that we have either content or images
    if (!content && imageUrls.length === 0) {
      throw new BadRequestException(
        'Message must have content or at least one image',
      );
    }

    // Send message using gateway's programmatic method (which handles WebSocket emissions)
    const message = await this.chatGateway.sendMessageProgrammatically({
      chatId: sendMessageDto.chatId,
      senderId: user.id,
      content: content,
      type: messageType,
      replyToId: sendMessageDto.replyToId,
      requestId: sendMessageDto.requestId,
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

    return message;
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
}
