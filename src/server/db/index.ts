import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "@/server/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let db: Database | undefined;

function createPool(): Pool {
  const nextPool = new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
  });

  if (process.env.VERCEL) {
    attachDatabasePool(nextPool);
  }

  return nextPool;
}

export function getDb(): Database {
  if (!db) {
    pool = createPool();
    db = drizzle(pool, { schema });
  }

  return db;
}

export { schema };
