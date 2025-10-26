import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '@app/common/decorators/public.decorator';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Public()
  check() {
    return this.healthService.getHealthStatus();
  }
}
