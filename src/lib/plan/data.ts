import "server-only";
import { and, asc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { cashFlowEntries, financialPlans, planBudgetItems, planGoals, planScenarios } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import { FLOW_TYPES, signedCents, type FlowType } from "@/lib/cash-flow-types";
import { getCashBalanceBefore } from "@/lib/data/cash-flow";
import { getInvestmentBalances } from "@/lib/data/investments";
import { addDaysIso, todayIso } from "@/lib/period";
import { emptyByType } from "@/lib/plan/calc";
import type { DocNode, PlanDataset, PlanInputs, PlanSection } from "@/lib/plan/types";

export type PlanRecord = PlanInputs & { id: string; year: number; updatedAt: Date };

export async function getPlan(companyId: string, year: number): Promise<PlanRecord | null> {
  const [plan] = await db
    .select()
    .from(financialPlans)
    .where(and(eq(financialPlans.companyId, companyId), eq(financialPlans.year, year)));
  if (!plan) return null;
  const [budget, goals, scenarios] = await Promise.all([
    db.select().from(planBudgetItems).where(eq(planBudgetItems.planId, plan.id)),
    db.select().from(planGoals).where(eq(planGoals.planId, plan.id)).orderBy(asc(planGoals.position), asc(planGoals.deadline)),
    db.select().from(planScenarios).where(eq(planScenarios.planId, plan.id)).orderBy(asc(planScenarios.position)),
  ]);
  return {
    id: plan.id,
    year: plan.year,
    updatedAt: plan.updatedAt,
    title: plan.title,
    diagnosisFrom: plan.diagnosisFrom,
    diagnosisTo: plan.diagnosisTo,
    content: plan.content as Partial<Record<PlanSection, DocNode>>,
    budget: budget.map((b) => ({ type: b.type, category: b.category, month: b.month, cents: toCents(b.amount) })),
    goals: goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetCents: toCents(g.targetAmount),
      initialCents: toCents(g.initialAmount),
      deadline: g.deadline,
      priority: g.priority,
      annualReturn: Number(g.annualReturn),
      investmentId: g.investmentId,
      notes: g.notes,
    })),
    scenarios: scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      revenueGrowth: Number(s.revenueGrowth),
      expenseGrowth: Number(s.expenseGrowth),
      inflation: Number(s.inflation),
      investmentReturn: Number(s.investmentReturn),
      horizonMonths: s.horizonMonths,
      events: s.events,
    })),
  };
}

/** Totais do fluxo de caixa por mês (AAAA-MM), tipo e categoria no período. */
async function monthlyRows(companyId: string, from: string, to: string) {
  const month = sql<string>`to_char(${cashFlowEntries.date}, 'YYYY-MM')`;
  const rows = await db
    .select({
      month,
      type: cashFlowEntries.type,
      category: sql<string>`coalesce(${cashFlowEntries.category}, 'Sem categoria')`,
      total: sql<string>`sum(${cashFlowEntries.amount})`,
    })
    .from(cashFlowEntries)
    .where(and(eq(cashFlowEntries.companyId, companyId), gte(cashFlowEntries.date, from), lte(cashFlowEntries.date, to)))
    .groupBy(month, cashFlowEntries.type, sql`coalesce(${cashFlowEntries.category}, 'Sem categoria')`);
  return rows.map((r) => ({ month: r.month, type: r.type as FlowType, category: r.category, cents: Math.round(Number(r.total) * 100) }));
}

function monthsOf(from: string, to: string) {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

const sumInvestments = async (companyId: string, date: string) =>
  (await getInvestmentBalances(companyId, date)).reduce((s, i) => s + i.balance, 0);

/** Números atuais do sistema para o plano (diagnóstico, realizado no ano, saldos e aplicações). */
export async function buildDataset(companyId: string, plan: Pick<PlanRecord, "year" | "diagnosisFrom" | "diagnosisTo">): Promise<PlanDataset> {
  const today = todayIso();
  const yearStart = `${plan.year}-01-01`;
  const yearEnd = `${plan.year}-12-31`;
  // As projeções partem do início do ano do plano; se ele ainda não começou, partem de hoje.
  const startDate = yearStart <= today ? yearStart : addDaysIso(today, 1);

  const [diagRows, yearRows, opening, diagCash, diagInvest, startCash, startInvest, investmentsToday, categories] = await Promise.all([
    monthlyRows(companyId, plan.diagnosisFrom, plan.diagnosisTo),
    monthlyRows(companyId, yearStart, yearEnd),
    getCashBalanceBefore(companyId, yearStart),
    getCashBalanceBefore(companyId, addDaysIso(plan.diagnosisTo, 1)),
    sumInvestments(companyId, plan.diagnosisTo),
    getCashBalanceBefore(companyId, startDate),
    sumInvestments(companyId, addDaysIso(startDate, -1)),
    getInvestmentBalances(companyId, today),
    db
      .selectDistinct({ category: cashFlowEntries.category })
      .from(cashFlowEntries)
      .where(and(eq(cashFlowEntries.companyId, companyId), isNotNull(cashFlowEntries.category)))
      .orderBy(asc(cashFlowEntries.category)),
  ]);

  const diagMonths = monthsOf(plan.diagnosisFrom, plan.diagnosisTo);
  const diagTotals = emptyByType();
  const diagByMonth = new Map(diagMonths.map((m) => [m, emptyByType()]));
  const diagCats = new Map<string, { type: FlowType; category: string; cents: number }>();
  for (const r of diagRows) {
    diagTotals[r.type] += r.cents;
    const bm = diagByMonth.get(r.month);
    if (bm) bm[r.type] += r.cents;
    const key = `${r.type}|${r.category}`;
    const c = diagCats.get(key) ?? { type: r.type, category: r.category, cents: 0 };
    c.cents += r.cents;
    diagCats.set(key, c);
  }

  const yearMonths = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, byType: emptyByType(), endBalance: 0 }));
  const yearCats: PlanDataset["actual"]["categories"] = [];
  for (const r of yearRows) {
    const month = Number(r.month.slice(5, 7));
    yearMonths[month - 1].byType[r.type] += r.cents;
    yearCats.push({ type: r.type, category: r.category, month, cents: r.cents });
  }
  let running = opening;
  for (const m of yearMonths) {
    for (const t of FLOW_TYPES) running += signedCents(t, m.byType[t]);
    m.endBalance = running;
  }

  return {
    generatedAt: new Date().toISOString(),
    today,
    year: plan.year,
    diagnosis: {
      from: plan.diagnosisFrom,
      to: plan.diagnosisTo,
      monthsCount: diagMonths.length,
      totals: diagTotals,
      months: diagMonths.map((m) => ({ month: m, byType: diagByMonth.get(m)! })),
      categories: [...diagCats.values()],
      cashBalance: diagCash,
      investmentsBalance: diagInvest,
    },
    actual: { openingBalance: opening, months: yearMonths, categories: yearCats },
    start: { date: startDate, cashBalance: startCash, investmentsBalance: startInvest },
    investments: investmentsToday.filter((i) => i.active || i.balance !== 0).map((i) => ({ id: i.id, name: i.name, kind: i.kind, balance: i.balance })),
    categories: categories.map((c) => c.category!),
  };
}
