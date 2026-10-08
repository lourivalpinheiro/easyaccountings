import "server-only";
import { and, eq, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cashFlowEntries } from "@/db/schema";

/** Saldo do caixa (entradas - saídas, em centavos) antes de uma data. */
export async function getCashBalanceBefore(companyId: string, date: string) {
  const [row] = await db
    .select({
      balance: sql<string>`coalesce(sum(case when ${cashFlowEntries.type} = 'entrada' then ${cashFlowEntries.amount} else -${cashFlowEntries.amount} end), 0)`,
    })
    .from(cashFlowEntries)
    .where(and(eq(cashFlowEntries.companyId, companyId), lt(cashFlowEntries.date, date)));
  return Math.round(Number(row.balance) * 100);
}

/** Totais de entradas e saídas no período (centavos). */
export async function getCashTotals(companyId: string, period: { from: string; to: string }, extra?: SQL) {
  const [row] = await db
    .select({
      inflow: sql<string>`coalesce(sum(case when ${cashFlowEntries.type} = 'entrada' then ${cashFlowEntries.amount} end), 0)`,
      outflow: sql<string>`coalesce(sum(case when ${cashFlowEntries.type} = 'saida' then ${cashFlowEntries.amount} end), 0)`,
    })
    .from(cashFlowEntries)
    .where(
      and(
        eq(cashFlowEntries.companyId, companyId),
        gte(cashFlowEntries.date, period.from),
        lte(cashFlowEntries.date, period.to),
        extra,
      ),
    );
  return { inflow: Math.round(Number(row.inflow) * 100), outflow: Math.round(Number(row.outflow) * 100) };
}
