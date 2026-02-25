import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Url } from '../entities/url.entity';
import { UrlStatus } from '../entities/url-status.enum';
import { CrawlBatch, CrawlBatchStatus } from '../entities/crawl-batch.entity';
import { RateLimitService } from '../core/rate-limit.service';
import { AmqpService } from '../../infra/amqp.service';
import { CrawlJobPayload } from '../core/crawl-job.interface';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer?: NodeJS.Timeout;

  private readonly intervalMs = Number(
    process.env.SCHEDULER_INTERVAL_MS ?? 1000,
  );
  private readonly batchSize = Number(process.env.SCHEDULER_BATCH_SIZE ?? 50);
  private readonly queueName = process.env.CRAWL_QUEUE_NAME ?? 'crawl_jobs';

  constructor(
    @InjectRepository(Url) private readonly urlRepo: Repository<Url>,
    @InjectRepository(CrawlBatch)
    private readonly batchRepo: Repository<CrawlBatch>,
    private readonly rateLimitService: RateLimitService,
    private readonly amqpService: AmqpService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.amqpService.assertQueue(this.queueName);
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.logger.log('Scheduler started');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    try {
      const candidates = await this.urlRepo
        .createQueryBuilder('url')
        .leftJoinAndSelect('url.batch', 'batch')
        .where('url.status = :status', { status: UrlStatus.Pending })
        .andWhere('(batch.id IS NULL OR batch.status IN (:...statuses))', {
          statuses: [CrawlBatchStatus.Pending, CrawlBatchStatus.Running],
        })
        .orderBy('url.createdAt', 'ASC')
        .limit(this.batchSize * 5)
        .getMany();

      let scheduled = 0;

      for (const url of candidates) {
        if (scheduled >= this.batchSize) {
          break;
        }

        const allowed = await this.rateLimitService.consume(url.domain);
        if (!allowed) {
          continue;
        }

        const updateResult = await this.urlRepo.update(
          { id: url.id, status: UrlStatus.Pending },
          { status: UrlStatus.Queued },
        );

        if (updateResult.affected !== 1) {
          continue;
        }

        const payload: CrawlJobPayload = {
          urlId: url.id,
          url: url.url,
          domain: url.domain,
          batchId: url.batchId ?? null,
          depth: url.depth,
          retryCount: url.retryCount,
          maxDepth:
            url.batch?.maxDepth ?? Number(process.env.DEFAULT_MAX_DEPTH ?? 3),
        };

        await this.amqpService.sendToQueue(
          this.queueName,
          Buffer.from(JSON.stringify(payload)),
        );

        scheduled += 1;
      }
    } catch (error) {
      this.logger.error('Scheduler tick failed', error as Error);
    }
  }
}
