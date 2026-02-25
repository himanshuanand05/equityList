/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsumeMessage } from 'amqplib';
import { Url } from '../entities/url.entity';
import { UrlStatus } from '../entities/url-status.enum';
import { CrawlBatch } from '../entities/crawl-batch.entity';
import { PageContent } from '../entities/page-content.entity';
import { AmqpService } from '../../infra/amqp.service';
import { CrawlJobPayload } from '../core/crawl-job.interface';
import { DedupService } from '../core/dedup.service';
import { normalizeUrl } from '../core/url-normalizer.util';

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);
  private readonly queueName = process.env.CRAWL_QUEUE_NAME ?? 'crawl_jobs';
  private readonly maxRetries = Number(process.env.CRAWLER_MAX_RETRIES ?? 3);
  private readonly fetchTimeoutMs = Number(
    process.env.CRAWLER_FETCH_TIMEOUT_MS ?? 10000,
  );
  private readonly snippetLength = Number(
    process.env.CRAWLER_SNIPPET_LENGTH ?? 1000,
  );

  constructor(
    private readonly amqpService: AmqpService,
    private readonly dedupService: DedupService,
    @InjectRepository(Url) private readonly urlRepo: Repository<Url>,
    @InjectRepository(CrawlBatch)
    private readonly batchRepo: Repository<CrawlBatch>,
    @InjectRepository(PageContent)
    private readonly pageContentRepo: Repository<PageContent>,
  ) {}

  async onModuleInit(): Promise<void> {
    const prefetch = Number(process.env.WORKER_PREFETCH ?? 10);
    await this.amqpService.setPrefetch(prefetch);
    await this.amqpService.consume(
      this.queueName,
      async (msg: ConsumeMessage) => {
        const raw: unknown = JSON.parse(msg.content.toString());
        const payload = raw as CrawlJobPayload;
        await this.handleJob(payload);
      },
    );
    this.logger.log(`Worker consuming from queue ${this.queueName}`);
  }

  private async handleJob(job: CrawlJobPayload): Promise<void> {
    const urlEntity = await this.urlRepo.findOne({ where: { id: job.urlId } });
    if (!urlEntity) {
      return;
    }

    await this.urlRepo.update(
      { id: urlEntity.id },
      { status: UrlStatus.InProgress, lastCrawlAt: new Date() },
    );

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);

      const response = await fetch(job.url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const statusCode = response.status;
      const headersObj: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersObj[key] = value;
      });

      const body = await response.text();
      const snippet = body.slice(0, this.snippetLength);

      const content = this.pageContentRepo.create({
        urlId: urlEntity.id,
        contentSnippet: snippet,
        headers: headersObj,
        statusCode,
      });
      await this.pageContentRepo.save(content);

      if (response.ok && statusCode >= 200 && statusCode < 400) {
        await this.discoverLinks(body, job);

        await this.urlRepo.update(
          { id: urlEntity.id },
          { status: UrlStatus.Done, lastError: null },
        );
      } else {
        await this.handleFailure(urlEntity.id, job, `HTTP ${statusCode}`);
      }
    } catch (error) {
      await this.handleFailure(urlEntity.id, job, (error as Error).message);
    }
  }

  private async handleFailure(
    urlId: string,
    job: CrawlJobPayload,
    message: string,
  ): Promise<void> {
    if (job.retryCount < this.maxRetries) {
      await this.urlRepo.update(
        { id: urlId },
        {
          status: UrlStatus.Pending,
          retryCount: job.retryCount + 1,
          lastError: message,
        },
      );

      const nextJob: CrawlJobPayload = {
        ...job,
        retryCount: job.retryCount + 1,
      };
      await this.amqpService.sendToQueue(
        this.queueName,
        Buffer.from(JSON.stringify(nextJob)),
      );
    } else {
      await this.urlRepo.update(
        { id: urlId },
        {
          status: UrlStatus.Failed,
          lastError: message,
        },
      );
    }
  }

  private async discoverLinks(
    html: string,
    job: CrawlJobPayload,
  ): Promise<void> {
    if (job.depth >= job.maxDepth) {
      return;
    }

    const links = extractLinksFromHtml(html, job.url);

    const batch =
      job.batchId !== null
        ? await this.batchRepo.findOne({ where: { id: job.batchId } })
        : null;

    let currentCount = 0;
    if (batch?.maxUrls) {
      currentCount = await this.urlRepo.count({
        where: { batchId: batch.id },
      });
    }

    for (const link of links) {
      if (batch?.maxUrls && currentCount >= batch.maxUrls) {
        break;
      }

      const { normalized, domain } = normalizeUrl(link);

      const isNew = await this.dedupService.isNewUrl(normalized);
      if (!isNew) {
        continue;
      }

      const newUrl = this.urlRepo.create({
        url: normalized,
        domain,
        depth: job.depth + 1,
        status: UrlStatus.Pending,
        batchId: job.batchId,
      });

      await this.urlRepo.save(newUrl);

      if (batch?.maxUrls) {
        currentCount += 1;
      }
    }
  }
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    try {
      const url = new URL(href, baseUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        links.add(url.toString());
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return Array.from(links);
}
