import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { UserError } from "@/lib/action-utils";
import { formatDate } from "@/lib/accounting";

/** Recusa lançamentos (contábeis ou financeiros) em data bloqueada pelo fechamento de período. */
export async function assertPeriodOpen(companyId: string, date: string) {
  const [company] = await db.select({ periodLockedUntil: companies.periodLockedUntil }).from(companies).where(eq(companies.id, companyId));
  if (company?.periodLockedUntil && date <= company.periodLockedUntil) {
    throw new UserError(`Período fechado até ${formatDate(company.periodLockedUntil)}. Não é possível lançar nessa data.`);
  }
}

/** Mesma regra, para quando várias datas são afetadas de uma vez (ex.: exclusão em massa). */
export async function assertPeriodOpenForDates(companyId: string, dates: string[]) {
  if (dates.length === 0) return;
  const [company] = await db.select({ periodLockedUntil: companies.periodLockedUntil }).from(companies).where(eq(companies.id, companyId));
  if (!company?.periodLockedUntil) return;
  if (dates.some((d) => d <= company.periodLockedUntil!)) {
    throw new UserError(`Período fechado até ${formatDate(company.periodLockedUntil)}. Há registros nessa data ou antes.`);
  }
}
