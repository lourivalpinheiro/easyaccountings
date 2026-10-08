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
