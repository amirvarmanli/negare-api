import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../core/users/user.entity';
import { Category } from './category.entity';
import { ProductAsset } from './product-asset.entity';
import { ProductFile } from './product-file.entity';
import { Tag } from './tag.entity';

export enum PricingType {
  FREE = 'FREE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  PAID = 'PAID',
  PAID_OR_SUBSCRIPTION = 'PAID_OR_SUBSCRIPTION',
}

@Entity({ name: 'products', schema: 'content' })
export class Product {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  coverUrl?: string;

  @Column({ type: 'enum', enum: PricingType })
  pricingType: PricingType;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price?: string | null;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  @Column({ type: 'int', default: 0 })
  downloadsCount: number;

  @Column({ type: 'int', default: 0 })
  likesCount: number;

  @OneToOne(() => ProductFile, (file) => file.product, {
    cascade: true,
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'file_id' })
  file?: ProductFile;

  @ManyToMany(() => User, { eager: false })
  @JoinTable({
    name: 'product_suppliers',
    schema: 'content',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  suppliers: User[];

  @ManyToMany(() => Category, (category) => category.products)
  @JoinTable({
    name: 'product_categories',
    schema: 'content',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' },
  })
  categories: Category[];

  @ManyToMany(() => Tag, (tag) => tag.products)
  @JoinTable({
    name: 'product_tags',
    schema: 'content',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @OneToMany(() => ProductAsset, (asset) => asset.product, {
    cascade: true,
  })
  assets: ProductAsset[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
