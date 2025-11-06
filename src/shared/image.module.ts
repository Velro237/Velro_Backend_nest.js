import { Module } from '@nestjs/common';
import { ImageService } from './services/image.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ImageController } from './controllers/image.controller';

@Module({
  imports: [PrismaModule],
  providers: [ImageService],
  controllers: [ImageController],
  exports: [ImageService],
})
export class ImageModule {}
