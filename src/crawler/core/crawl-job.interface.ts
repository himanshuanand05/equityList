export interface CrawlJobPayload {
  urlId: string;
  url: string;
  domain: string;
  batchId: string | null;
  depth: number;
  retryCount: number;
  maxDepth: number;
}
