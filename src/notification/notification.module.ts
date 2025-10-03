import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { firebaseAdminProvider } from './providers/firebase-admin.provider';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, firebaseAdminProvider],
  exports: [NotificationService, firebaseAdminProvider],
})
export class NotificationModule {}
