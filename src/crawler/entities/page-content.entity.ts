import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Url } from './url.entity';

@Entity({ name: 'page_contents' })
export class PageContent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  urlId!: string;

  @OneToOne(() => Url)
  @JoinColumn({ name: 'urlId' })
  url?: Url;

  @Column({ type: 'text', nullable: true })
  contentHash!: string | null;

  @Column({ type: 'text', nullable: true })
  contentSnippet!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  headers!: Record<string, string> | null;

  @Column({ type: 'int', nullable: true })
  statusCode!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fetchedAt!: Date;
}
