export class CreateBatchDto {
  name!: string;
  seedUrls!: string[];
  maxDepth!: number;
  maxUrls?: number | null;
}
