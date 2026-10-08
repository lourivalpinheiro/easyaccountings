"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { journalEntries, journalLines } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { companyAction, UserError } from "@/lib/action-utils";
import { insertEntry } from "@/lib/data/entries";
import { getChart } from "@/lib/data/ledger";

const entrySchema = z.object({
  id: z.uuid().optional(),
  date: z.iso.date("Informe a data."),
  historyCode: z.number().int().positive().nullable(),
  description: z.string().trim().min(1, "Informe a descrição."),
  lines: z.array(
    z.object({
      accountId: z.uuid("Selecione a conta de todas as linhas."),
      side: z.enum(["D", "C"]),
      cents: z.number().int().positive("Todos os valores devem ser maiores que zero."),
    }),
  ),
});

export async function saveEntry(input: z.input<typeof entrySchema>) {
  return companyAction(async ({ companyId, userId }) => {
    const parsed = entrySchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, lines, ...entry } = parsed.data;

    const debits = lines.filter((l) => l.side === "D");
    const credits = lines.filter((l) => l.side === "C");
    if (debits.length === 0 || credits.length === 0) {
      throw new UserError("O lançamento precisa de ao menos um débito e um crédito.");
    }
    const totalD = debits.reduce((s, l) => s + l.cents, 0);
    const totalC = credits.reduce((s, l) => s + l.cents, 0);
    if (totalD !== totalC) throw new UserError("O total de débitos deve ser igual ao total de créditos.");

    const chart = await getChart(companyId);
    for (const l of lines) {
      const acc = chart.find((a) => a.id === l.accountId);
      if (!acc) throw new UserError("Conta inválida.");
      if (!acc.analytic) throw new UserError(`A conta ${acc.classification} é sintética e não recebe lançamentos.`);
    }

    const result = await db.transaction(async (tx) => {
      if (!id) return insertEntry(tx, { ...entry, companyId, createdBy: userId }, lines);

      const [current] = await tx
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.id, id), eq(journalEntries.companyId, companyId)));
      if (!current) throw new UserError("Lançamento não encontrado.");
      if (current.closingBatchId) throw new UserError("Lançamentos de zeramento só podem ser estornados pelo zeramento.");

      await tx.update(journalEntries).set(entry).where(eq(journalEntries.id, id));
      await tx.delete(journalLines).where(eq(journalLines.entryId, id));
      await tx.insert(journalLines).values(
        lines.map((l, i) => ({ entryId: id, accountId: l.accountId, side: l.side, amount: centsToDecimal(l.cents), position: i })),
      );
      return { id, number: current.number };
    });
    revalidatePath("/", "layout");
    return result;
  });
}

export async function deleteEntry(id: string) {
  return companyAction(async ({ companyId }) => {
    const [current] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.companyId, companyId)));
    if (!current) throw new UserError("Lançamento não encontrado.");
    if (current.closingBatchId) throw new UserError("Lançamentos de zeramento só podem ser estornados pelo zeramento.");
    await db.delete(journalEntries).where(eq(journalEntries.id, id));
    revalidatePath("/", "layout");
  });
}
