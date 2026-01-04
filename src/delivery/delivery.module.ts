import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ImageModule } from '../shared/image.module';

@Module({
  imports: [PrismaModule, ImageModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
