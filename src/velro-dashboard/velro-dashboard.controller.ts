import { Controller } from '@nestjs/common';
import { VelroDashboardService } from './velro-dashboard.service';

@Controller()
export class VelroDashboardController {
  constructor(private readonly velroDashboardService: VelroDashboardService) {}
}
