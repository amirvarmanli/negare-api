import { randomUUID } from 'node:crypto';
import { DataSource, DataSourceOptions } from 'typeorm';
import { newDb } from 'pg-mem';

export async function createTestDataSource(
  options: Partial<DataSourceOptions>,
): Promise<DataSource> {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  const publicSchema = db.public;

  publicSchema.registerFunction({
    name: 'uuid_generate_v4',
    implementation: () => randomUUID(),
  });
  publicSchema.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 14.0 (pg-mem)',
  });
  publicSchema.registerFunction({
    name: 'current_database',
    implementation: () => 'pg_mem',
  });

  const dataSource = await db.adapters.createTypeormDataSource({
    type: 'postgres',
    synchronize: true,
    logging: false,
    ...options,
  });

  await dataSource.initialize();
  return dataSource;
}
