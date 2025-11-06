import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ImageModule } from '../shared/image.module';

@Module({
  imports: [PrismaModule, AuthModule, ImageModule],
  controllers: [UserController, AdminController],
  providers: [UserService],
})
export class UserModule {}
