import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, journalLines } from "@/db/schema";
import { toCents } from "@/lib/accounting";

export type LedgerLine = {
  entryId: string;
  number: number;
  date: string;
  historyCode: number | null;
  description: string;
  accountId: string;
  side: "D" | "C";
  cents: number;
};

/** Linhas de lançamento do período em ordem cronológica. */
export async function getLedgerLines(
  companyId: string,
  period: { from: string; to: string },
  accountIds?: string[],
): Promise<LedgerLine[]> {
  if (accountIds && accountIds.length === 0) return [];
  const rows = await db
    .select({
      entryId: journalEntries.id,
      number: journalEntries.number,
      date: journalEntries.date,
      historyCode: journalEntries.historyCode,
      description: journalEntries.description,
      accountId: journalLines.accountId,
      side: journalLines.side,
      amount: journalLines.amount,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(
      and(
        eq(journalEntries.companyId, companyId),
        gte(journalEntries.date, period.from),
        lte(journalEntries.date, period.to),
        accountIds ? inArray(journalLines.accountId, accountIds) : undefined,
      ),
    )
    .orderBy(asc(journalEntries.date), asc(journalEntries.number), asc(journalLines.position));
  return rows.map(({ amount, ...r }) => ({ ...r, cents: toCents(amount) }));
}

/** Todas as linhas dos lançamentos informados (para identificar contrapartidas). */
export async function getEntryLines(entryIds: string[]) {
  if (entryIds.length === 0) return [];
  const rows = await db
    .select({ entryId: journalLines.entryId, accountId: journalLines.accountId, side: journalLines.side })
    .from(journalLines)
    .where(inArray(journalLines.entryId, entryIds));
  return rows;
}

export function groupByDate<T extends { date: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.date);
    if (list) list.push(item);
    else map.set(item.date, [item]);
  }
  return [...map.entries()];
}
