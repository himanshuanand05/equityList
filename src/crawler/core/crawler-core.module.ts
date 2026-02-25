import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Url } from '../entities/url.entity';
import { CrawlBatch } from '../entities/crawl-batch.entity';
import { PageContent } from '../entities/page-content.entity';
import { DedupService } from './dedup.service';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [TypeOrmModule.forFeature([Url, CrawlBatch, PageContent])],
  providers: [DedupService, RateLimitService],
  exports: [TypeOrmModule, DedupService, RateLimitService],
})
export class CrawlerCoreModule {}
