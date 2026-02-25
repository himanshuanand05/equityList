import { Body, Controller, Param, Post } from '@nestjs/common';
import { RateLimitService } from '../core/rate-limit.service';

@Controller('domains')
export class DomainsController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  @Post(':domain/block')
  async block(@Param('domain') domain: string) {
    await this.rateLimitService.blockDomain(domain);
    return { domain, blocked: true };
  }

  @Post(':domain/unblock')
  async unblock(@Param('domain') domain: string) {
    await this.rateLimitService.unblockDomain(domain);
    return { domain, blocked: false };
  }

  @Post('check')
  async check(@Body() body: { domain: string }) {
    const blocked = await this.rateLimitService.isBlocked(body.domain);
    return { domain: body.domain, blocked };
  }
}
