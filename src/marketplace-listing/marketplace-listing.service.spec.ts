import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceListingService } from './marketplace-listing.service';

describe('MarketplaceListingService', () => {
  let service: MarketplaceListingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarketplaceListingService],
    }).compile();

    service = module.get<MarketplaceListingService>(MarketplaceListingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
