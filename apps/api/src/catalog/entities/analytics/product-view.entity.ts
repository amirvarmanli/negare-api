import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'product_views', schema: 'analytics' })
export class ProductView {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  productId: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ nullable: true })
  ip?: string;

  @Column({ nullable: true })
  ua?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}


