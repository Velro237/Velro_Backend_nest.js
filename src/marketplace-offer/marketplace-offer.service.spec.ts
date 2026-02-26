import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceOfferService } from './marketplace-offer.service';

describe('MarketplaceOfferService', () => {
  let service: MarketplaceOfferService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarketplaceOfferService],
    }).compile();

    service = module.get<MarketplaceOfferService>(MarketplaceOfferService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
