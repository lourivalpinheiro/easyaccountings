import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { journalEntries, journalLines } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";

/** Próximo número de lançamento da empresa, serializado por lock transacional. */
export async function nextEntryNumber(tx: Tx, companyId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${companyId}))`);
  const [row] = await tx
    .select({ next: sql<number>`coalesce(max(${journalEntries.number}), 0) + 1` })
    .from(journalEntries)
    .where(eq(journalEntries.companyId, companyId));
  return Number(row.next);
}

export type LineInput = { accountId: string; side: "D" | "C"; cents: number };

export async function insertEntry(
  tx: Tx,
  entry: {
    companyId: string;
    date: string;
    description: string;
    historyCode?: number | null;
    closingBatchId?: string;
    createdBy?: string;
  },
  lines: LineInput[],
) {
  const number = await nextEntryNumber(tx, entry.companyId);
  const [created] = await tx
    .insert(journalEntries)
    .values({ ...entry, number })
    .returning({ id: journalEntries.id, number: journalEntries.number });
  await tx.insert(journalLines).values(
    lines.map((l, i) => ({
      entryId: created.id,
      accountId: l.accountId,
      side: l.side,
      amount: centsToDecimal(l.cents),
      position: i,
    })),
  );
  return created;
}
