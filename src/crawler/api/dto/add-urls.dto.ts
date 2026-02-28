import { ApiProperty } from '@nestjs/swagger';

export class AddUrlsDto {
  @ApiProperty({ description: 'Batch ID to add URLs to', example: 'uuid' })
  batchId!: string;

  @ApiProperty({
    description: 'URLs to add to the batch',
    example: ['https://example.com/page1', 'https://example.com/page2'],
    type: [String],
  })
  urls!: string[];
}
