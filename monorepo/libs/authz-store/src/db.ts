import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

export type Db = Pool | PoolClient;

let pool: Pool | null = null;

export function createAuthzPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export function getAuthzPool(connectionString: string | undefined): Pool | null {
  if (!connectionString) return null;
  if (!pool) pool = createAuthzPool(connectionString);
  return pool;
}

export async function query<T extends QueryResultRow>(
  db: Db,
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return db.query<T>(text, values);
}
