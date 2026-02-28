import { ApiProperty } from '@nestjs/swagger';

export class CheckDomainDto {
  @ApiProperty({
    description: 'Domain to check block status for',
    example: 'example.com',
  })
  domain!: string;
}
