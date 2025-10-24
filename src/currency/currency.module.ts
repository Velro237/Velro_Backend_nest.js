import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';
import { CountryDetectionService } from './country-detection.service';
import { CountriesApiService } from './countries-api.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule],
  providers: [CurrencyService, CountryDetectionService, CountriesApiService],
  controllers: [CurrencyController],
  exports: [CurrencyService, CountryDetectionService, CountriesApiService],
})
export class CurrencyModule {}
