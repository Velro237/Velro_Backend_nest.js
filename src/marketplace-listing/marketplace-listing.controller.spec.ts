import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceListingController } from './marketplace-listing.controller';
import { MarketplaceListingService } from './marketplace-listing.service';

describe('MarketplaceListingController', () => {
  let controller: MarketplaceListingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceListingController],
      providers: [MarketplaceListingService],
    }).compile();

    controller = module.get<MarketplaceListingController>(MarketplaceListingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
