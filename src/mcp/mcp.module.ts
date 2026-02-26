import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfraModule } from '../infra/infra.module';
import { CrawlerCoreModule } from '../crawler/core/crawler-core.module';
import { CrawlerApiModule } from '../crawler/api/crawler-api.module';
import { Url } from '../crawler/entities/url.entity';
import { CrawlBatch } from '../crawler/entities/crawl-batch.entity';
import { PageContent } from '../crawler/entities/page-content.entity';
import { McpServerService } from './mcp-server.service';

@Module({
  imports: [
    InfraModule,
    CrawlerCoreModule,
    CrawlerApiModule,
    TypeOrmModule.forFeature([Url, CrawlBatch, PageContent]),
  ],
  providers: [McpServerService],
  exports: [McpServerService],
})
export class McpModule {}

