import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

// O pooler do Supabase em modo transação não suporta prepared statements.
// max baixo e idle_timeout curto: em dev o servidor é reiniciado com frequência (HMR/restart),
// então conexões ociosas devem devolver a vaga ao pooler rápido em vez de ficarem presas.
const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL!, { prepare: false, max: 3, idle_timeout: 20 });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
