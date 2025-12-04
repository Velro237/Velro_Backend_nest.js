import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { firebaseAdminProvider } from './providers/firebase-admin.provider';
import { EmailQueue } from './queues/email.queue';
import { EmailProcessor } from './processors/email.processor';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    firebaseAdminProvider,
    EmailQueue,
    EmailProcessor,
  ],
  exports: [NotificationService, firebaseAdminProvider, EmailQueue],
})
export class NotificationModule {}
