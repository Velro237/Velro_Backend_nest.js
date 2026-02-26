import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceOfferController } from './marketplace-offer.controller';
import { MarketplaceOfferService } from './marketplace-offer.service';

describe('MarketplaceOfferController', () => {
  let controller: MarketplaceOfferController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceOfferController],
      providers: [MarketplaceOfferService],
    }).compile();

    controller = module.get<MarketplaceOfferController>(MarketplaceOfferController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
