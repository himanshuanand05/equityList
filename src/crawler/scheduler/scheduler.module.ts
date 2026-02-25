import { Module } from '@nestjs/common';
import { CrawlerCoreModule } from '../core/crawler-core.module';
import { InfraModule } from '../../infra/infra.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [InfraModule, CrawlerCoreModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
