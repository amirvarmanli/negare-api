import {
  Column,
  CreateDateColumn,
  Entity,
  Unique,
} from 'typeorm';

@Entity({ name: 'bookmarks', schema: 'content' })
@Unique(['userId', 'productId'])
export class Bookmark {
  @Column({ type: 'uuid', primary: true })
  userId: string;

  @Column({ type: 'bigint', primary: true })
  productId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
