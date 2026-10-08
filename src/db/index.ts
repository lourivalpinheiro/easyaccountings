import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

// O pooler do Supabase em modo transação não suporta prepared statements.
const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
