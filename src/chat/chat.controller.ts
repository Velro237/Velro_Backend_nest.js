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
import { ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
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
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateChat()
  async createChat(
    @Body() createChatDto: CreateChatDto,
    @CurrentUser() user: User,
    @I18nLang() lang: string,
  ): Promise<CreateChatResponseDto> {
    return this.chatService.createChat(createChatDto, user.id, lang);
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
}
