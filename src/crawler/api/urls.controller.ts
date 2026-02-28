import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrawlerApiService } from './crawler-api.service';
import { AddUrlsDto } from './dto/add-urls.dto';

@ApiTags('URLs')
@Controller('urls')
export class UrlsController {
  constructor(private readonly crawlerApiService: CrawlerApiService) {}

  @Post()
  @ApiOperation({ summary: 'Add URLs to an existing batch' })
  @ApiBody({ type: AddUrlsDto })
  @ApiResponse({ status: 200, description: 'URLs added successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid request or batch not found.' })
  async addUrls(@Body() dto: AddUrlsDto) {
    await this.crawlerApiService.addUrls(dto);
    return { ok: true };
  }
}
