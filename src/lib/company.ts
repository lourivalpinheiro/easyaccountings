import "server-only";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { companies, userCompanies } from "@/db/schema";

export const COMPANY_COOKIE = "ea_company";

type AccessUser = { id: string; role: string; pinnedCompanyId?: string | null };

export const listCompanies = cache(() => db.select().from(companies).orderBy(asc(companies.legalName)));

/** Empresas que o usuário pode acessar: todas para admin, só as liberadas por um admin para "user". */
export const listAccessibleCompanies = cache(async (user: AccessUser) => {
  const all = await listCompanies();
  if (user.role === "admin") return all;
  const grants = await db.select({ companyId: userCompanies.companyId }).from(userCompanies).where(eq(userCompanies.userId, user.id));
  const allowed = new Set(grants.map((g) => g.companyId));
  return all.filter((c) => allowed.has(c.id));
});

/** Empresa ativa escolhida pelo usuário (ou a fixada, ou a primeira acessível). */
export const getActiveCompany = cache(async (user: AccessUser) => {
  const cookieStore = await cookies();
  const accessible = await listAccessibleCompanies(user);
  const id = cookieStore.get(COMPANY_COOKIE)?.value;
  if (id) {
    const found = accessible.find((c) => c.id === id);
    if (found) return found;
  }
  if (user.pinnedCompanyId) {
    const pinned = accessible.find((c) => c.id === user.pinnedCompanyId);
    if (pinned) return pinned;
  }
  return accessible[0] ?? null;
});

export type Company = typeof companies.$inferSelect;
