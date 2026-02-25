import { Module } from '@nestjs/common';
import { CrawlerCoreModule } from '../core/crawler-core.module';
import { InfraModule } from '../../infra/infra.module';
import { WorkerService } from './worker.service';

@Module({
  imports: [InfraModule, CrawlerCoreModule],
  providers: [WorkerService],
})
export class WorkerModule {}
