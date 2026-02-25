import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from '../../infra/redis.service';

@Injectable()
export class DedupService {
  private readonly key = 'crawler:seen_urls';

  constructor(private readonly redisService: RedisService) {}

  async isNewUrl(url: string): Promise<boolean> {
    const hash = createHash('sha1').update(url).digest('hex');
    const client = this.redisService.getClient();
    const added = await client.sadd(this.key, hash);
    return added === 1;
  }
}
