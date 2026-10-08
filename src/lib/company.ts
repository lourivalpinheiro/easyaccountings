import "server-only";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { companies } from "@/db/schema";

export const COMPANY_COOKIE = "ea_company";

export const listCompanies = cache(() =>
  db.select().from(companies).orderBy(asc(companies.legalName)),
);

/** Empresa ativa escolhida pelo usuário (ou a primeira cadastrada). */
export const getActiveCompany = cache(async () => {
  const cookieStore = await cookies();
  const id = cookieStore.get(COMPANY_COOKIE)?.value;
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (company) return company;
  }
  const all = await listCompanies();
  return all[0] ?? null;
});

export type Company = typeof companies.$inferSelect;
