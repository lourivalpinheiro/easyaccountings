import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

// Pool do node-postgres com o pooler do Supabase (modo transação; o pg não usa prepared statements nomeados).
// Na Vercel a função é congelada entre requisições e conexões ociosas podem morrer nesse intervalo: o
// attachDatabasePool mantém a instância viva até as ociosas serem fechadas, evitando consultas que travam
// numa conexão morta. Os timeouts garantem erro (em vez de espera infinita) se a rede falhar mesmo assim.
const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
    keepAlive: true,
  });

attachDatabasePool(pool);

// Em dev o servidor recarrega módulos com frequência: reaproveita o mesmo pool.
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
