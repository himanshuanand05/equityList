import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infra/redis.service';

interface RateLimitConfig {
  tokensPerInterval: number;
  intervalMs: number;
}

@Injectable()
export class RateLimitService {
  private readonly defaultConfig: RateLimitConfig = {
    tokensPerInterval: Number(process.env.CRAWLER_TOKENS_PER_INTERVAL ?? 1),
    intervalMs: Number(process.env.CRAWLER_INTERVAL_MS ?? 1000),
  };

  constructor(private readonly redisService: RedisService) {}

  async isBlocked(domain: string): Promise<boolean> {
    const client = this.redisService.getClient();
    const key = 'crawler:blocked_domains';
    const result = await client.sismember(key, domain.toLowerCase());
    return result === 1;
  }

  async blockDomain(domain: string): Promise<void> {
    const client = this.redisService.getClient();
    const key = 'crawler:blocked_domains';
    await client.sadd(key, domain.toLowerCase());
  }

  async unblockDomain(domain: string): Promise<void> {
    const client = this.redisService.getClient();
    const key = 'crawler:blocked_domains';
    await client.srem(key, domain.toLowerCase());
  }

  async consume(domain: string): Promise<boolean> {
    if (await this.isBlocked(domain)) {
      return false;
    }

    const client = this.redisService.getClient();
    const key = `crawler:rate:${domain}`;
    const now = Date.now();
    const intervalMs = this.defaultConfig.intervalMs;
    const tokensPerInterval = this.defaultConfig.tokensPerInterval;

    const [lastTsRaw, tokensRaw] = await client.hmget(key, 'lastTs', 'tokens');
    const lastTs = lastTsRaw ? Number(lastTsRaw) : now;
    const tokens = tokensRaw ? Number(tokensRaw) : tokensPerInterval;

    const elapsed = now - lastTs;
    const refill = Math.floor(elapsed / intervalMs) * tokensPerInterval;
    const newTokens = Math.min(tokensPerInterval, tokens + refill);

    if (newTokens <= 0) {
      return false;
    }

    await client.hset(key, {
      lastTs: now.toString(),
      tokens: (newTokens - 1).toString(),
    });

    await client.pexpire(key, intervalMs * 10);

    return true;
  }
}
