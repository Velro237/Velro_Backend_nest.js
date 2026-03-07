import { Test, TestingModule } from '@nestjs/testing';
import { VelroDashboardController } from './velro-dashboard.controller';
import { VelroDashboardService } from './velro-dashboard.service';

describe('VelroDashboardController', () => {
  let controller: VelroDashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VelroDashboardController],
      providers: [VelroDashboardService],
    }).compile();

    controller = module.get<VelroDashboardController>(VelroDashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
