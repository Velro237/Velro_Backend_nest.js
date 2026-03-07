import { Test, TestingModule } from '@nestjs/testing';
import { VelroDashboardService } from './velro-dashboard.service';

describe('VelroDashboardService', () => {
  let service: VelroDashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VelroDashboardService],
    }).compile();

    service = module.get<VelroDashboardService>(VelroDashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
