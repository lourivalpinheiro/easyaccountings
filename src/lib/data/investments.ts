import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { cashFlowEntries, investments, investmentValuations } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import type { InvestmentKind } from "@/lib/investment-types";

export type InvestmentBalance = {
  id: string;
  name: string;
  kind: InvestmentKind;
  institution: string | null;
  notes: string | null;
  active: boolean;
  /** Aportes (economias) menos resgates (entradas) ligados à aplicação, até a data. */
  invested: number;
  /** Último saldo informado até a data, se houver. */
  lastValuation: { date: string; balance: number } | null;
  /** Saldo na data: último saldo informado + aportes - resgates feitos depois dele. */
  balance: number;
};

/** Saldo de cada aplicação da empresa numa data (centavos). */
export async function getInvestmentBalances(companyId: string, date: string): Promise<InvestmentBalance[]> {
  const list = await db.select().from(investments).where(eq(investments.companyId, companyId)).orderBy(asc(investments.name));
  if (list.length === 0) return [];
  const ids = list.map((i) => i.id);
  const [valuations, movements] = await Promise.all([
    db
      .select()
      .from(investmentValuations)
      .where(and(inArray(investmentValuations.investmentId, ids), lte(investmentValuations.date, date)))
      .orderBy(desc(investmentValuations.date)),
    db
      .select({
        investmentId: cashFlowEntries.investmentId,
        date: cashFlowEntries.date,
        type: cashFlowEntries.type,
        amount: cashFlowEntries.amount,
      })
      .from(cashFlowEntries)
      .where(
        and(
          eq(cashFlowEntries.companyId, companyId),
          isNotNull(cashFlowEntries.investmentId),
          lte(cashFlowEntries.date, date),
        ),
      ),
  ]);

  return list.map((inv) => {
    const last = valuations.find((v) => v.investmentId === inv.id);
    const lastValuation = last ? { date: last.date, balance: toCents(last.balance) } : null;
    let invested = 0;
    let after = 0;
    for (const m of movements) {
      if (m.investmentId !== inv.id) continue;
      // Economia é aporte na aplicação; entrada é resgate (o dinheiro volta ao caixa).
      const delta = m.type === "economia" ? toCents(m.amount) : m.type === "entrada" ? -toCents(m.amount) : 0;
      invested += delta;
      if (!lastValuation || m.date > lastValuation.date) after += delta;
    }
    return {
      id: inv.id,
      name: inv.name,
      kind: inv.kind,
      institution: inv.institution,
      notes: inv.notes,
      active: inv.active,
      invested,
      lastValuation,
      balance: (lastValuation?.balance ?? 0) + after,
    };
  });
}

export async function getInvestmentOptions(companyId: string) {
  return db
    .select({ id: investments.id, name: investments.name, active: investments.active })
    .from(investments)
    .where(eq(investments.companyId, companyId))
    .orderBy(asc(investments.name));
}
