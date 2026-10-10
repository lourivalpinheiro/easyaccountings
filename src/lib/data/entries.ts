import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { journalEntries, journalLines } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { UserError } from "@/lib/action-utils";
import { getChart } from "@/lib/data/ledger";

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

/**
 * Partidas D/C de um lançamento que espelha uma movimentação de caixa: entrada debita o caixa/banco e credita
 * a contrapartida; saída faz o inverso. Usado pela integração contábil do fluxo de caixa e pela baixa de
 * contas a pagar/receber do provisionamento. Por convenção a posição 0 é sempre a conta de caixa/banco.
 */
export function cashMirrorLines(
  isInflow: boolean,
  cents: number,
  accounts: { bankAccountId: string; counterAccountId: string },
): LineInput[] {
  const bankSide = isInflow ? "D" : "C";
  const counterSide = isInflow ? "C" : "D";
  return [
    { accountId: accounts.bankAccountId, side: bankSide, cents },
    { accountId: accounts.counterAccountId, side: counterSide, cents },
  ];
}

/** Garante que as contas escolhidas para um lançamento espelhado existem e são analíticas. */
export async function validateMirrorAccounts(companyId: string, accounts: { bankAccountId: string; counterAccountId: string }) {
  const chart = await getChart(companyId);
  for (const id of [accounts.bankAccountId, accounts.counterAccountId]) {
    const acc = chart.find((a) => a.id === id);
    if (!acc) throw new UserError("Conta contábil inválida.");
    if (!acc.analytic) throw new UserError(`A conta ${acc.classification} é sintética e não recebe lançamentos.`);
  }
}
