import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrawlBatch, CrawlBatchStatus } from '../entities/crawl-batch.entity';
import { Url } from '../entities/url.entity';
import { UrlStatus } from '../entities/url-status.enum';
import { CreateBatchDto } from './dto/create-batch.dto';
import { AddUrlsDto } from './dto/add-urls.dto';
import { normalizeUrl } from '../core/url-normalizer.util';
import { DedupService } from '../core/dedup.service';

@Injectable()
export class CrawlerApiService {
  constructor(
    @InjectRepository(CrawlBatch)
    private readonly batchRepo: Repository<CrawlBatch>,
    @InjectRepository(Url)
    private readonly urlRepo: Repository<Url>,
    private readonly dedupService: DedupService,
  ) {}

  async createBatch(dto: CreateBatchDto): Promise<CrawlBatch> {
    const batch = this.batchRepo.create({
      name: dto.name,
      seedUrl: dto.seedUrls[0],
      maxDepth: dto.maxDepth,
      maxUrls: dto.maxUrls ?? null,
      status: CrawlBatchStatus.Pending,
    });
    const savedBatch = await this.batchRepo.save(batch);

    for (const raw of dto.seedUrls) {
      const { normalized, domain } = normalizeUrl(raw);
      const isNew = await this.dedupService.isNewUrl(normalized);
      if (!isNew) {
        continue;
      }

      const url = this.urlRepo.create({
        url: normalized,
        domain,
        depth: 0,
        status: UrlStatus.Pending,
        batchId: savedBatch.id,
      });

      await this.urlRepo.save(url);
    }

    return savedBatch;
  }

  async addUrls(dto: AddUrlsDto): Promise<void> {
    const batch = await this.batchRepo.findOne({ where: { id: dto.batchId } });
    if (!batch) {
      return;
    }

    let currentCount = 0;
    if (batch.maxUrls) {
      currentCount = await this.urlRepo.count({ where: { batchId: batch.id } });
    }

    for (const raw of dto.urls) {
      if (batch.maxUrls && currentCount >= batch.maxUrls) {
        break;
      }

      const { normalized, domain } = normalizeUrl(raw);
      const isNew = await this.dedupService.isNewUrl(normalized);
      if (!isNew) {
        continue;
      }

      const url = this.urlRepo.create({
        url: normalized,
        domain,
        depth: 0,
        status: UrlStatus.Pending,
        batchId: batch.id,
      });

      await this.urlRepo.save(url);

      if (batch.maxUrls) {
        currentCount += 1;
      }
    }
  }

  async getBatchStatus(id: string): Promise<{
    batch: CrawlBatch | null;
    counts: Record<string, number>;
  }> {
    const batch = await this.batchRepo.findOne({ where: { id } });
    if (!batch) {
      return { batch: null, counts: {} };
    }

    const statuses: UrlStatus[] = [
      UrlStatus.Pending,
      UrlStatus.Queued,
      UrlStatus.InProgress,
      UrlStatus.Done,
      UrlStatus.Failed,
      UrlStatus.Skipped,
    ];

    const counts: Record<string, number> = {};

    await Promise.all(
      statuses.map(async (status) => {
        const count = await this.urlRepo.count({
          where: { batchId: batch.id, status },
        });
        counts[status] = count;
      }),
    );

    return { batch, counts };
  }

  async setBatchStatus(id: string, status: CrawlBatchStatus): Promise<void> {
    await this.batchRepo.update({ id }, { status });
  }
}
