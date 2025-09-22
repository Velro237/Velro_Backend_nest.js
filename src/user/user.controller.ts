import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { I18nLang, I18nService, I18n, I18nContext } from 'nestjs-i18n';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { ApiUserWelcome } from './decorators/api-docs.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from 'generated/prisma';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private i18n: I18nService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiUserWelcome()
  async getMe(@CurrentUser() user: User, @I18nLang() lang: string) {
    const message = await this.i18n.translate('translation.hello', {
      lang,
      args: { name: user.email.split('@')[0] }, // Use email prefix as name
    });

    return {
      message,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }
 
  // // Method 1: @I18n() decorator (SHORTHAND - Most Popular)
  // @Get('welcome-shorthand')
  // async getWelcomeShorthand(@I18n() i18n: I18nContext) {
  //   const message = await i18n.t('translation.hello', {
  //     args: { name: 'prince' },
  //   });
  //   return { message };
  // }

  // @Post()
  // create(@Body() createUserDto: CreateUserDto) {
  //   return this.userService.create(createUserDto);
  // }

  // @Get()
  // async findAll() {
  //   return [];
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.userService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
  //   return this.userService.update(+id, updateUserDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.userService.remove(+id);
  // }
}
