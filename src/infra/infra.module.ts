import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Url } from '../crawler/entities/url.entity';
import { CrawlBatch } from '../crawler/entities/crawl-batch.entity';
import { PageContent } from '../crawler/entities/page-content.entity';
import { RedisService } from './redis.service';
import { AmqpService } from './amqp.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [Url, CrawlBatch, PageContent],
        synchronize: true,
      }),
    }),
  ],
  providers: [RedisService, AmqpService],
  exports: [RedisService, AmqpService, TypeOrmModule],
})
export class InfraModule {}
