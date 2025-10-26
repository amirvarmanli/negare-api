import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity({ name: 'product_files', schema: 'content' })
export class ProductFile {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @OneToOne(() => Product, (product) => product.file, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @Column({ select: false })
  storageKey: string;

  @Column({ nullable: true })
  originalName?: string;

  @Column({ type: 'bigint', nullable: true })
  size?: string;

  @Column({ nullable: true })
  mimeType?: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
