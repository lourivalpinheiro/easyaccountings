import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, lt, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cashFlowEntries, journalEntries, journalLines } from "@/db/schema";
import { FLOW_TYPES, isInflow, signedCents, type FlowType } from "@/lib/cash-flow-types";
import { todayIso } from "@/lib/period";

export type LinkedJournalInfo = {
  journalEntryId: string;
  entryNumber: number;
  bankAccountId: string;
  counterAccountId: string;
  historyCode: number | null;
};

/**
 * Dados do lançamento contábil vinculado a cada movimentação (para pré-preencher a aba Contabilidade ao editar).
 * As duas linhas do lançamento são gravadas sempre na mesma ordem: posição 0 é a conta de caixa/banco, 1 é a contrapartida.
 */
export async function getLinkedJournalInfo(cashFlowEntryIds: string[]): Promise<Map<string, LinkedJournalInfo>> {
  if (cashFlowEntryIds.length === 0) return new Map();
  const rows = await db
    .select({
      cashFlowEntryId: cashFlowEntries.id,
      journalEntryId: journalEntries.id,
      entryNumber: journalEntries.number,
      historyCode: journalEntries.historyCode,
      accountId: journalLines.accountId,
      position: journalLines.position,
    })
    .from(cashFlowEntries)
    .innerJoin(journalEntries, eq(journalEntries.id, cashFlowEntries.journalEntryId))
    .innerJoin(journalLines, eq(journalLines.entryId, journalEntries.id))
    .where(and(inArray(cashFlowEntries.id, cashFlowEntryIds), isNotNull(cashFlowEntries.journalEntryId)))
    .orderBy(asc(journalLines.position));

  const byEntry = new Map<string, typeof rows>();
  for (const r of rows) byEntry.set(r.cashFlowEntryId, [...(byEntry.get(r.cashFlowEntryId) ?? []), r]);

  const result = new Map<string, LinkedJournalInfo>();
  for (const [id, lines] of byEntry) {
    const [bank, counter] = lines;
    if (!bank || !counter) continue;
    result.set(id, {
      journalEntryId: bank.journalEntryId,
      entryNumber: bank.entryNumber,
      bankAccountId: bank.accountId,
      counterAccountId: counter.accountId,
      historyCode: bank.historyCode,
    });
  }
  return result;
}

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

/**
 * Totais do período (centavos): entradas, saídas (todo dinheiro que deixa o caixa: saída,
 * economia e cartão de crédito) e o valor de cada tipo.
 */
export async function getCashTotals(companyId: string, period: { from: string; to: string }, extra?: SQL) {
  const rows = await db
    .select({ type: cashFlowEntries.type, total: sql<string>`coalesce(sum(${cashFlowEntries.amount}), 0)` })
    .from(cashFlowEntries)
    .where(
      and(
        eq(cashFlowEntries.companyId, companyId),
        gte(cashFlowEntries.date, period.from),
        lte(cashFlowEntries.date, period.to),
        extra,
      ),
    )
    .groupBy(cashFlowEntries.type);
  const byType = Object.fromEntries(FLOW_TYPES.map((t) => [t, 0])) as Record<FlowType, number>;
  for (const r of rows) byType[r.type] = Math.round(Number(r.total) * 100);
  const inflow = byType.entrada;
  const outflow = FLOW_TYPES.filter((t) => !isInflow(t)).reduce((sum, t) => sum + byType[t], 0);
  return { inflow, outflow, byType };
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
    const net = signedCents(r.type, Math.round(Number(r.amount) * 100));
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

const pad = (n: number) => String(n).padStart(2, "0");

export type CalendarDay = { date: string; balance: number; projected: boolean };
export type CalendarMonth = { year: number; month: number; label: string; days: (CalendarDay | null)[] };

/**
 * Saldo final de cada dia do mês atual e dos meses seguintes, a partir de todas as movimentações
 * registradas, inclusive as agendadas (datas futuras e ocorrências recorrentes).
 * Dias depois de hoje são marcados como `projected`, pois dependem de movimentações ainda não realizadas.
 * `totalMonths` inclui o mês atual (3 = mês atual + 2 meses seguintes).
 */
export async function getCalendarBalances(companyId: string, totalMonths: number): Promise<CalendarMonth[]> {
  const today = todayIso();
  const [currentYear, currentMonth] = today.split("-").map(Number);
  const rangeStart = `${currentYear}-${pad(currentMonth)}-01`;
  const endTotal = currentMonth - 1 + totalMonths - 1;
  const endYear = currentYear + Math.floor(endTotal / 12);
  const endMonth = (endTotal % 12) + 1;
  const rangeEnd = `${endYear}-${pad(endMonth)}-${pad(new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate())}`;

  const [balanceBeforeStart, rows] = await Promise.all([
    getCashBalanceBefore(companyId, rangeStart),
    db
      .select({ date: cashFlowEntries.date, type: cashFlowEntries.type, amount: cashFlowEntries.amount })
      .from(cashFlowEntries)
      .where(
        and(eq(cashFlowEntries.companyId, companyId), gte(cashFlowEntries.date, rangeStart), lte(cashFlowEntries.date, rangeEnd)),
      ),
  ]);

  const netByDate = new Map<string, number>();
  for (const r of rows) {
    netByDate.set(r.date, (netByDate.get(r.date) ?? 0) + signedCents(r.type, Math.round(Number(r.amount) * 100)));
  }

  let running = balanceBeforeStart;
  const months: CalendarMonth[] = [];
  for (let i = 0; i < totalMonths; i++) {
    const total = currentMonth - 1 + i;
    const year = currentYear + Math.floor(total / 12);
    const month = (total % 12) + 1;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days: CalendarDay[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${pad(month)}-${pad(day)}`;
      running += netByDate.get(date) ?? 0;
      days.push({ date, balance: running, projected: date > today });
    }
    months.push({ year, month, label: `${MONTH_LABELS[month - 1]}/${String(year).slice(2)}`, days });
  }
  return months;
}
