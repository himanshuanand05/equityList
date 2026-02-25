import { Module } from '@nestjs/common';
import { InfraModule } from './infra/infra.module';
import { CrawlerApiModule } from './crawler/api/crawler-api.module';

@Module({
  imports: [InfraModule, CrawlerApiModule],
})
export class AppModule {}
