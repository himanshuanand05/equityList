import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  McpServer,
  type CallToolResult,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.ts';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Repository } from 'typeorm';
import { CrawlerApiService } from '../crawler/api/crawler-api.service';
import { PageContent } from '../crawler/entities/page-content.entity';
import { CrawlBatch } from '../crawler/entities/crawl-batch.entity';
import { Url } from '../crawler/entities/url.entity';

@Injectable()
export class McpServerService implements OnModuleInit, OnModuleDestroy {
  private readonly server: McpServer;
  private transport?: StdioServerTransport;

  constructor(
    @InjectRepository(PageContent)
    private readonly pageContentRepo: Repository<PageContent>,
    @InjectRepository(Url)
    private readonly urlRepo: Repository<Url>,
    @InjectRepository(CrawlBatch)
    private readonly batchRepo: Repository<CrawlBatch>,
    private readonly crawlerApiService: CrawlerApiService,
  ) {
    this.server = new McpServer(
      {
        name: 'equity-list-crawler',
        version: '0.1.0',
      },
      {
        capabilities: {
          logging: {},
        },
      },
    );

    this.registerTools();
    this.registerResources();
    this.registerPrompts();
  }

  async onModuleInit(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
  }

  async onModuleDestroy(): Promise<void> {
    await this.transport?.close();
  }

  private registerTools(): void {
    this.server.registerTool(
      'search_pages',
      {
        title: 'Search crawled pages',
        description:
          'Search crawled pages by domain or substring match in URL or content snippet.',
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              'Search text to match against URL and content snippet. Use keywords, domain, or partial URL.',
            ),
          limit: z
            .number()
            .int()
            .positive()
            .max(100)
            .default(20)
            .describe(
              'Maximum number of pages to return (defaults to 20, max 100).',
            )
            .optional(),
          offset: z
            .number()
            .int()
            .nonnegative()
            .default(0)
            .describe('Number of results to skip (for pagination).')
            .optional(),
        }),
      },
      async ({ query, limit = 20, offset = 0 }): Promise<CallToolResult> => {
        const normalizedQuery = query.trim();

        if (!normalizedQuery) {
          return {
            content: [
              {
                type: 'text',
                text: 'Empty query; please provide a non-empty search string.',
              },
            ],
          };
        }

        const qb = this.pageContentRepo
          .createQueryBuilder('page')
          .leftJoinAndSelect('page.url', 'url')
          .where(
            'url.url ILIKE :q OR url.domain ILIKE :q OR page.contentSnippet ILIKE :q',
            { q: `%${normalizedQuery}%` },
          )
          .orderBy('page.fetchedAt', 'DESC')
          .take(limit)
          .skip(offset);

        const pages = await qb.getMany();

        const items = pages.map((page) => ({
          id: page.id,
          urlId: page.urlId,
          url: page.url?.url ?? null,
          domain: page.url?.domain ?? null,
          statusCode: page.statusCode,
          fetchedAt: page.fetchedAt,
          snippet: page.contentSnippet,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query: normalizedQuery,
                  count: items.length,
                  results: items,
                },
                null,
                2,
              ),
            },
          ],
          structuredContent: {
            query: normalizedQuery,
            count: items.length,
            results: items,
          },
        };
      },
    );

    this.server.registerTool(
      'get_page_by_url',
      {
        title: 'Get page by URL',
        description:
          'Fetch a single crawled page (metadata and snippet) by its exact URL.',
        inputSchema: z.object({
          url: z
            .string()
            .url()
            .describe('Exact URL of the page as stored by the crawler.'),
        }),
      },
      async ({ url }): Promise<CallToolResult> => {
        const urlEntity = await this.urlRepo.findOne({
          where: { url },
        });

        if (!urlEntity) {
          return {
            content: [
              {
                type: 'text',
                text: `No URL found for ${url}`,
              },
            ],
          };
        }

        const page = await this.pageContentRepo.findOne({
          where: { urlId: urlEntity.id },
        });

        if (!page) {
          return {
            content: [
              {
                type: 'text',
                text: `URL ${url} exists but no page content is stored yet.`,
              },
            ],
          };
        }

        const payload = {
          id: page.id,
          urlId: page.urlId,
          url: urlEntity.url,
          domain: urlEntity.domain,
          statusCode: page.statusCode,
          fetchedAt: page.fetchedAt,
          snippet: page.contentSnippet,
          headers: page.headers,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
          structuredContent: payload,
        };
      },
    );

    this.server.registerTool(
      'list_batches',
      {
        title: 'List crawl batches',
        description: 'List recent crawl batches with basic statistics.',
        inputSchema: z.object({
          limit: z
            .number()
            .int()
            .positive()
            .max(100)
            .default(20)
            .describe('Maximum number of batches to list.')
            .optional(),
          offset: z
            .number()
            .int()
            .nonnegative()
            .default(0)
            .describe('Number of batches to skip (for pagination).')
            .optional(),
        }),
      },
      async ({ limit = 20, offset = 0 }): Promise<CallToolResult> => {
        const [batches, total] = await this.batchRepo.findAndCount({
          order: { createdAt: 'DESC' },
          take: limit,
          skip: offset,
        });

        const items = batches.map((batch) => ({
          id: batch.id,
          name: batch.name,
          seedUrl: batch.seedUrl,
          status: batch.status,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total,
                  count: items.length,
                  results: items,
                },
                null,
                2,
              ),
            },
          ],
          structuredContent: {
            total,
            count: items.length,
            results: items,
          },
        };
      },
    );

    this.server.registerTool(
      'get_batch_details',
      {
        title: 'Get crawl batch details',
        description:
          'Fetch a crawl batch and a summary of URL statuses within it.',
        inputSchema: z.object({
          batchId: z
            .string()
            .uuid()
            .describe('ID of the crawl batch to inspect.'),
        }),
      },
      async ({ batchId }): Promise<CallToolResult> => {
        const batch = await this.batchRepo.findOne({
          where: { id: batchId },
        });

        if (!batch) {
          return {
            content: [
              {
                type: 'text',
                text: `No batch found for id ${batchId}`,
              },
            ],
          };
        }

        const [{ total }, grouped] = await Promise.all([
          this.urlRepo
            .createQueryBuilder('url')
            .select('COUNT(*)', 'total')
            .where('url.batchId = :batchId', { batchId })
            .getRawOne<{ total: string }>(),
          this.urlRepo
            .createQueryBuilder('url')
            .select('url.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('url.batchId = :batchId', { batchId })
            .groupBy('url.status')
            .getRawMany<{ status: string; count: string }>(),
        ]);

        const counts: Record<string, number> = {};
        for (const row of grouped) {
          counts[row.status] = Number(row.count);
        }

        const payload = {
          batch: {
            id: batch.id,
            name: batch.name,
            seedUrl: batch.seedUrl,
            status: batch.status,
            maxDepth: batch.maxDepth,
            maxUrls: batch.maxUrls,
            createdAt: batch.createdAt,
            updatedAt: batch.updatedAt,
          },
          urlCounts: counts,
          totalUrls: Number(total ?? 0),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
          structuredContent: payload,
        };
      },
    );

    this.server.registerTool(
      'enqueue_crawl_batch',
      {
        title: 'Create and enqueue a new crawl batch',
        description:
          'Create a new crawl batch with seed URLs so the scheduler/worker can process it.',
        inputSchema: z.object({
          name: z
            .string()
            .min(1)
            .describe('Human-readable name for this batch.'),
          seedUrls: z
            .array(z.string().url())
            .min(1)
            .describe('Seed URLs to start crawling from.'),
          maxDepth: z
            .number()
            .int()
            .min(0)
            .max(10)
            .default(3)
            .describe('Maximum crawl depth from each seed URL.'),
          maxUrls: z
            .number()
            .int()
            .positive()
            .max(50000)
            .nullable()
            .optional()
            .describe(
              'Optional cap on the total number of URLs in this batch.',
            ),
        }),
      },
      async ({
        name,
        seedUrls,
        maxDepth,
        maxUrls,
      }): Promise<CallToolResult> => {
        const batch = await this.crawlerApiService.createBatch({
          name,
          seedUrls,
          maxDepth,
          maxUrls: maxUrls ?? undefined,
        });

        const payload = {
          id: batch.id,
          name: batch.name,
          seedUrl: batch.seedUrl,
          status: batch.status,
          maxDepth: batch.maxDepth,
          maxUrls: batch.maxUrls,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
          structuredContent: payload,
        };
      },
    );
  }

  private registerResources(): void {
    this.server.registerResource(
      'page-by-url',
      new ResourceTemplate('page://by-url/{encodedUrl}', {}),
      {
        title: 'Page by URL',
        description:
          'Fetch a crawled page by its URL, including metadata and snippet.',
        mimeType: 'application/json',
      },
      async (uri, params) => {
        const encodedUrl = params.encodedUrl;
        const decodedUrl = decodeURIComponent(encodedUrl);

        const urlEntity = await this.urlRepo.findOne({
          where: { url: decodedUrl },
        });

        if (!urlEntity) {
          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify(
                  {
                    error: 'not_found',
                    message: `No URL found for ${decodedUrl}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const page = await this.pageContentRepo.findOne({
          where: { urlId: urlEntity.id },
        });

        if (!page) {
          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify(
                  {
                    error: 'no_content',
                    message: `URL ${decodedUrl} exists but has no stored page content yet.`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const payload = {
          id: page.id,
          urlId: page.urlId,
          url: urlEntity.url,
          domain: urlEntity.domain,
          statusCode: page.statusCode,
          fetchedAt: page.fetchedAt,
          snippet: page.contentSnippet,
          headers: page.headers,
        };

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      },
    );

    this.server.registerResource(
      'batch-summary',
      new ResourceTemplate('batch://{batchId}', {
        async list() {
          return { resources: [] };
        },
      }),
      {
        title: 'Crawl batch summary',
        description:
          'Summary information for a single crawl batch, including URL status counts.',
        mimeType: 'application/json',
      },
      async (uri, params) => {
        const batchId = params.batchId;

        const batch = await this.batchRepo.findOne({
          where: { id: batchId },
        });

        if (!batch) {
          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify(
                  {
                    error: 'not_found',
                    message: `No batch found for id ${batchId}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const [{ total }, grouped] = await Promise.all([
          this.urlRepo
            .createQueryBuilder('url')
            .select('COUNT(*)', 'total')
            .where('url.batchId = :batchId', { batchId })
            .getRawOne<{ total: string }>(),
          this.urlRepo
            .createQueryBuilder('url')
            .select('url.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('url.batchId = :batchId', { batchId })
            .groupBy('url.status')
            .getRawMany<{ status: string; count: string }>(),
        ]);

        const counts: Record<string, number> = {};
        for (const row of grouped) {
          counts[row.status] = Number(row.count);
        }

        const payload = {
          batch: {
            id: batch.id,
            name: batch.name,
            seedUrl: batch.seedUrl,
            status: batch.status,
            maxDepth: batch.maxDepth,
            maxUrls: batch.maxUrls,
            createdAt: batch.createdAt,
            updatedAt: batch.updatedAt,
          },
          urlCounts: counts,
          totalUrls: Number(total ?? 0),
        };

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      },
    );
  }

  private registerPrompts(): void {
    this.server.registerPrompt(
      'investigate_domain',
      {
        title: 'Investigate a domain',
        description:
          'Investigate what the crawler has discovered about a given domain.',
        argsSchema: z.object({
          domain: z
            .string()
            .min(1)
            .describe('Domain name to investigate, e.g. example.com'),
        }),
      },
      ({ domain }) => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                'Use the available tools and resources to investigate this domain.',
                '',
                `Domain: ${domain}`,
                '',
                '- First, call `search_pages` with the domain name as part of the query to find representative pages.',
                '- For any especially relevant URLs, use `get_page_by_url` or the `page://by-url/{encodedUrl}` resource to inspect details.',
                '- If you need batch-level context, call `list_batches` and `get_batch_details` or read `batch://{batchId}` resources.',
                '- Summarize what the site appears to be about, notable sections, and anything unusual.',
              ].join('\n'),
            },
          },
        ],
      }),
    );

    this.server.registerPrompt(
      'summarize_domain_topic',
      {
        title: 'Summarize topic coverage on a domain',
        description:
          'Summarize how a specific topic is covered across pages within a domain.',
        argsSchema: z.object({
          domain: z
            .string()
            .min(1)
            .describe('Domain name, e.g. example.com'),
          topic: z
            .string()
            .min(1)
            .describe('Topic to search for, e.g. pricing, careers, product name.'),
        }),
      },
      ({ domain, topic }) => ({
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                'Analyze how the given topic is covered on the specified domain.',
                '',
                `Domain: ${domain}`,
                `Topic: ${topic}`,
                '',
                '- Use `search_pages` with a query that includes both the domain and topic.',
                '- Inspect individual pages with `get_page_by_url` or the `page://by-url/{encodedUrl}` resource if more context is needed.',
                '- Group findings by page type or section (e.g., landing page, docs, blog).',
                '- Provide a concise summary of how the topic is presented, any gaps, and notable details.',
              ].join('\n'),
            },
          },
        ],
      }),
    );
  }
}

