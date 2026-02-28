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
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        return {
          type: 'postgres',
          // Use URL if set (e.g. production); otherwise use individual params for local PostgreSQL
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: process.env.DB_HOST ?? 'localhost',
                port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
                username: process.env.DB_USER ?? 'postgres',
                password: process.env.DB_PASSWORD ?? '',
                database: process.env.DB_NAME ?? 'equitylist',
              }),
          entities: [Url, CrawlBatch, PageContent],
          synchronize: true,
        };
      },
    }),
  ],
  providers: [RedisService, AmqpService],
  exports: [RedisService, AmqpService, TypeOrmModule],
})
export class InfraModule {}
