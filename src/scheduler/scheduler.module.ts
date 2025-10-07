import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AlertSchedulerService } from './alert-scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationModule,
    AuthModule,
  ],
  controllers: [SchedulerController],
  providers: [AlertSchedulerService],
  exports: [AlertSchedulerService],
})
export class SchedulerModule {}
