import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KycController } from './controllers/kyc.controller';
import { KycService } from './services/kyc.service';
import { DiditService } from './services/didit.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [KycController],
  providers: [KycService, DiditService],
  exports: [KycService, DiditService],
})
export class KycModule {}
