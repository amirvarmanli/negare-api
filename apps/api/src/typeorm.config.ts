import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: ['error', 'warn'],
};

export default new DataSource(dataSourceOptions);
