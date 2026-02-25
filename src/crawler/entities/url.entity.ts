import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UrlStatus } from './url-status.enum';
import { CrawlBatch } from './crawl-batch.entity';

@Entity({ name: 'urls' })
@Index(['status'])
@Index(['domain', 'status'])
export class Url {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  url!: string;

  @Column({ type: 'text' })
  domain!: string;

  @Column({ type: 'int', default: 0 })
  depth!: number;

  @Column({
    type: 'enum',
    enum: UrlStatus,
    default: UrlStatus.Pending,
  })
  status!: UrlStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastCrawlAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'uuid', nullable: true })
  batchId!: string | null;

  @ManyToOne(() => CrawlBatch, (batch) => batch.urls, { nullable: true })
  @JoinColumn({ name: 'batchId' })
  batch?: CrawlBatch | null;
}
