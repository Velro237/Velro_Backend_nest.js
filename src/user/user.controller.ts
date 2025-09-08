import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { I18nLang, I18nService, I18n, I18nContext } from 'nestjs-i18n';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private i18n: I18nService,
  ) {}

  @Get('welcome')
  async getWelcome(@I18nLang() lang: string) {
    // That's it! Just use i18n.t()
    // const message = await i18n.t('translation.welcome');
    const message = await this.i18n.translate('translation.hello', {
      lang,
      args: { name: 'prince' },
    });
    return { message };
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
