import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CrawlerApiService } from './crawler-api.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { CrawlBatchStatus } from '../entities/crawl-batch.entity';

@Controller('batches')
export class BatchesController {
  constructor(private readonly crawlerApiService: CrawlerApiService) {}

  @Post()
  async createBatch(@Body() dto: CreateBatchDto) {
    const batch = await this.crawlerApiService.createBatch(dto);
    return batch;
  }

  @Get(':id')
  async getBatch(@Param('id') id: string) {
    return this.crawlerApiService.getBatchStatus(id);
  }

  @Post(':id/pause')
  async pauseBatch(@Param('id') id: string) {
    await this.crawlerApiService.setBatchStatus(id, CrawlBatchStatus.Paused);
    return { id, status: CrawlBatchStatus.Paused };
  }

  @Post(':id/resume')
  async resumeBatch(@Param('id') id: string) {
    await this.crawlerApiService.setBatchStatus(id, CrawlBatchStatus.Running);
    return { id, status: CrawlBatchStatus.Running };
  }
}
