import { Module } from '@nestjs/common';
import { CrawlerCoreModule } from '../core/crawler-core.module';
import { InfraModule } from '../../infra/infra.module';
import { CrawlerApiService } from './crawler-api.service';
import { BatchesController } from './batches.controller';
import { UrlsController } from './urls.controller';
import { DomainsController } from './domains.controller';

@Module({
  imports: [InfraModule, CrawlerCoreModule],
  providers: [CrawlerApiService],
  controllers: [BatchesController, UrlsController, DomainsController],
})
export class CrawlerApiModule {}
