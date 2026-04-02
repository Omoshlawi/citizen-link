import { Controller, Get } from '@nestjs/common';
import { RegionService } from './region.service';

@Controller('config')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  /**
   * Returns the deployment's region configuration.
   * Public — no authentication required.
   * Clients (mobile/web) fetch this on startup to configure themselves.
   */
  @Get('public')
  getPublicConfig() {
    return this.regionService.getPublicConfig();
  }
}
