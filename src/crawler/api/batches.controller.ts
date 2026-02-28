import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CrawlerApiService } from './crawler-api.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { CrawlBatchStatus } from '../entities/crawl-batch.entity';

@ApiTags('Batches')
@Controller('batches')
export class BatchesController {
  constructor(private readonly crawlerApiService: CrawlerApiService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new crawl batch' })
  @ApiBody({ type: CreateBatchDto })
  @ApiResponse({ status: 201, description: 'Batch created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid request body.' })
  async createBatch(@Body() dto: CreateBatchDto) {
    const batch = await this.crawlerApiService.createBatch(dto);
    return batch;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get batch status by ID' })
  @ApiParam({ name: 'id', description: 'Batch UUID' })
  @ApiResponse({ status: 200, description: 'Batch status returned.' })
  @ApiResponse({ status: 404, description: 'Batch not found.' })
  async getBatch(@Param('id') id: string) {
    return this.crawlerApiService.getBatchStatus(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a running batch' })
  @ApiParam({ name: 'id', description: 'Batch UUID' })
  @ApiResponse({ status: 200, description: 'Batch paused.' })
  @ApiResponse({ status: 404, description: 'Batch not found.' })
  async pauseBatch(@Param('id') id: string) {
    await this.crawlerApiService.setBatchStatus(id, CrawlBatchStatus.Paused);
    return { id, status: CrawlBatchStatus.Paused };
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused batch' })
  @ApiParam({ name: 'id', description: 'Batch UUID' })
  @ApiResponse({ status: 200, description: 'Batch resumed.' })
  @ApiResponse({ status: 404, description: 'Batch not found.' })
  async resumeBatch(@Param('id') id: string) {
    await this.crawlerApiService.setBatchStatus(id, CrawlBatchStatus.Running);
    return { id, status: CrawlBatchStatus.Running };
  }
}
