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
} from './decorators/api-docs.decorator';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
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

    // Notify users about the new chat
    await this.chatGateway.notifyChatCreated(
      result.chat.id,
      [user.id, createChatDto.otherUserId],
      result.chat.name || 'New Chat',
      result.lastMessage,
    );

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
}
