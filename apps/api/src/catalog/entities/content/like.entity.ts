import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  Unique,
} from 'typeorm';

@Entity({ name: 'likes', schema: 'content' })
@Unique(['userId', 'productId'])
@Index('likes_product_idx', ['productId'])
export class Like {
  @Column({ type: 'uuid', primary: true })
  userId: string;

  @Column({ type: 'bigint', primary: true })
  productId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
