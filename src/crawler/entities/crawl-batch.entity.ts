import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Url } from './url.entity';

export enum CrawlBatchStatus {
  Pending = 'pending',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
}

@Entity({ name: 'crawl_batches' })
export class CrawlBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  seedUrl!: string;

  @Column({ type: 'int', default: 0 })
  maxDepth!: number;

  @Column({ type: 'int', nullable: true })
  maxUrls!: number | null;

  @Column({
    type: 'enum',
    enum: CrawlBatchStatus,
    default: CrawlBatchStatus.Pending,
  })
  status!: CrawlBatchStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Url, (url) => url.batch)
  urls?: Url[];
}
