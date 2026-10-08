import "server-only";
import { and, asc, eq, gte, lt, lte, sql, type SQL } from "drizzle-orm";
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

/** Saldo final de cada dia com movimento no período, em ordem cronológica. */
export async function getDailyBalances(companyId: string, period: { from: string; to: string }) {
  const [before, rows] = await Promise.all([
    getCashBalanceBefore(companyId, period.from),
    db
      .select({ date: cashFlowEntries.date, type: cashFlowEntries.type, amount: cashFlowEntries.amount })
      .from(cashFlowEntries)
      .where(
        and(eq(cashFlowEntries.companyId, companyId), gte(cashFlowEntries.date, period.from), lte(cashFlowEntries.date, period.to)),
      )
      .orderBy(asc(cashFlowEntries.date)),
  ]);

  const netByDate = new Map<string, number>();
  for (const r of rows) {
    const cents = Math.round(Number(r.amount) * 100);
    const net = r.type === "entrada" ? cents : -cents;
    netByDate.set(r.date, (netByDate.get(r.date) ?? 0) + net);
  }

  let running = before;
  const days: { date: string; balance: number }[] = [];
  for (const date of [...netByDate.keys()].sort()) {
    running += netByDate.get(date)!;
    days.push({ date, balance: running });
  }
  return days;
}

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TREND_WINDOW_DAYS = 90;

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type CalendarDay = { date: string; balance: number; projected: boolean };
export type CalendarMonth = { year: number; month: number; label: string; days: (CalendarDay | null)[] };

/**
 * Saldo final de cada dia do mês atual até hoje (real) e dos meses seguintes (projeção:
 * saldo de hoje + tendência média dos últimos 90 dias aplicada dia a dia).
 * `totalMonths` inclui o mês atual (3 = mês atual + 2 meses seguintes).
 */
export async function getCalendarBalances(companyId: string, totalMonths: number): Promise<CalendarMonth[]> {
  const now = new Date();
  const today = ymd(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeStart = ymd(monthStart);
  const endMonthFirst = new Date(now.getFullYear(), now.getMonth() + totalMonths - 1, 1);
  const rangeEnd = ymd(new Date(endMonthFirst.getFullYear(), endMonthFirst.getMonth() + 1, 0));
  const trendStart = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - TREND_WINDOW_DAYS));

  const [balanceBeforeStart, rows, trend] = await Promise.all([
    getCashBalanceBefore(companyId, rangeStart),
    db
      .select({ date: cashFlowEntries.date, type: cashFlowEntries.type, amount: cashFlowEntries.amount })
      .from(cashFlowEntries)
      .where(
        and(eq(cashFlowEntries.companyId, companyId), gte(cashFlowEntries.date, rangeStart), lte(cashFlowEntries.date, today)),
      ),
    getCashTotals(companyId, { from: trendStart, to: today }),
  ]);

  const netByDate = new Map<string, number>();
  for (const r of rows) {
    const cents = Math.round(Number(r.amount) * 100);
    const net = r.type === "entrada" ? cents : -cents;
    netByDate.set(r.date, (netByDate.get(r.date) ?? 0) + net);
  }

  const balanceByDate = new Map<string, { balance: number; projected: boolean }>();
  let running = balanceBeforeStart;
  for (const d = new Date(monthStart); ymd(d) <= today; d.setDate(d.getDate() + 1)) {
    const date = ymd(d);
    running += netByDate.get(date) ?? 0;
    balanceByDate.set(date, { balance: running, projected: false });
  }
  const todayBalance = running;
  const avgDailyNet = (trend.inflow - trend.outflow) / TREND_WINDOW_DAYS;
  let step = 1;
  for (const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); ymd(d) <= rangeEnd; d.setDate(d.getDate() + 1), step++) {
    balanceByDate.set(ymd(d), { balance: Math.round(todayBalance + avgDailyNet * step), projected: true });
  }

  const months: CalendarMonth[] = [];
  for (const cursor = new Date(monthStart); cursor <= endMonthFirst; cursor.setMonth(cursor.getMonth() + 1)) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: (CalendarDay | null)[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const entry = balanceByDate.get(date);
      days.push(entry ? { date, ...entry } : null);
    }
    months.push({ year, month, label: `${MONTH_LABELS[month - 1]}/${String(year).slice(2)}`, days });
  }
  return months;
}
