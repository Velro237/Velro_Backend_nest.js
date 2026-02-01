import { Module } from '@nestjs/common';
import { ShippingRequestService } from './shipping-request.service';
import { ShippingRequestController } from './shipping-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [ShippingRequestController],
  providers: [ShippingRequestService],
  exports: [ShippingRequestService],
})
export class ShippingRequestModule {}
