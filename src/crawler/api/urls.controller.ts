import { Body, Controller, Post } from '@nestjs/common';
import { CrawlerApiService } from './crawler-api.service';
import { AddUrlsDto } from './dto/add-urls.dto';

@Controller('urls')
export class UrlsController {
  constructor(private readonly crawlerApiService: CrawlerApiService) {}

  @Post()
  async addUrls(@Body() dto: AddUrlsDto) {
    await this.crawlerApiService.addUrls(dto);
    return { ok: true };
  }
}
