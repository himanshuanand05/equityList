import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RateLimitService } from '../core/rate-limit.service';
import { CheckDomainDto } from './dto/check-domain.dto';

@ApiTags('Domains')
@Controller('domains')
export class DomainsController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  @Post(':domain/block')
  @ApiOperation({ summary: 'Block a domain' })
  @ApiParam({ name: 'domain', description: 'Domain to block (e.g. example.com)' })
  @ApiResponse({ status: 200, description: 'Domain blocked.' })
  async block(@Param('domain') domain: string) {
    await this.rateLimitService.blockDomain(domain);
    return { domain, blocked: true };
  }

  @Post(':domain/unblock')
  @ApiOperation({ summary: 'Unblock a domain' })
  @ApiParam({
    name: 'domain',
    description: 'Domain to unblock (e.g. example.com)',
  })
  @ApiResponse({ status: 200, description: 'Domain unblocked.' })
  async unblock(@Param('domain') domain: string) {
    await this.rateLimitService.unblockDomain(domain);
    return { domain, blocked: false };
  }

  @Post('check')
  @ApiOperation({ summary: 'Check if a domain is blocked' })
  @ApiBody({ type: CheckDomainDto })
  @ApiResponse({ status: 200, description: 'Block status for the domain.' })
  async check(@Body() body: CheckDomainDto) {
    const blocked = await this.rateLimitService.isBlocked(body.domain);
    return { domain: body.domain, blocked };
  }
}
