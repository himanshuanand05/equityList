import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBatchDto {
  @ApiProperty({ description: 'Batch name', example: 'My crawl batch' })
  name!: string;

  @ApiProperty({
    description: 'Seed URLs to start crawling from',
    example: ['https://example.com'],
    type: [String],
  })
  seedUrls!: string[];

  @ApiProperty({ description: 'Maximum crawl depth', example: 2 })
  maxDepth!: number;

  @ApiPropertyOptional({
    description: 'Maximum number of URLs to crawl (optional)',
    example: 1000,
    nullable: true,
  })
  maxUrls?: number | null;
}
