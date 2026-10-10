"use server";

import { and, eq, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Tx } from "@/db";
import { db } from "@/db";
import { cashFlowEntries, investments, journalEntries, journalLines } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { FLOW_TYPES, FREQUENCIES, isInflow, MAX_OCCURRENCES, occurrenceDates, type FlowType } from "@/lib/cash-flow-types";
import { companyAction, UserError } from "@/lib/action-utils";
import { cashMirrorLines, insertEntry, validateMirrorAccounts } from "@/lib/data/entries";
import { assertPeriodOpen } from "@/lib/period-lock";

const contabilSchema = z.object({
  bankAccountId: z.uuid("Selecione a conta de caixa/banco."),
  counterAccountId: z.uuid("Selecione a conta de contrapartida."),
  historyCode: z.number().int().positive().nullable().default(null),
});

const entrySchema = z.object({
  id: z.uuid().optional(),
  date: z.iso.date("Informe a data."),
  type: z.enum(FLOW_TYPES),
  description: z.string().trim().min(1, "Informe a descrição.").max(200),
  category: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null),
  cents: z.number().int().positive("O valor deve ser maior que zero."),
  investmentId: z.uuid().nullable().default(null),
  frequency: z.enum(FREQUENCIES).default("unica"),
  occurrences: z
    .number()
    .int()
    .min(1, "Informe a quantidade de repetições.")
    .max(MAX_OCCURRENCES, `No máximo ${MAX_OCCURRENCES} repetições.`)
    .default(1),
  /** undefined = não mexe no vínculo contábil; null = desvincula/remove; objeto = cria ou atualiza o vínculo. */
  contabil: contabilSchema.nullable().optional(),
});

/** Cria o lançamento contábil espelhando a movimentação de caixa. */
async function createLinkedEntry(
  tx: Tx,
  companyId: string,
  userId: string,
  entry: { date: string; description: string; type: FlowType },
  cents: number,
  contabil: { bankAccountId: string; counterAccountId: string; historyCode: number | null },
) {
  return insertEntry(
    tx,
    { companyId, date: entry.date, description: entry.description, historyCode: contabil.historyCode, createdBy: userId },
    cashMirrorLines(isInflow(entry.type), cents, contabil),
  );
}

/** Atualiza o lançamento contábil já vinculado para refletir os dados atuais da movimentação. */
async function syncLinkedEntry(
  tx: Tx,
  journalEntryId: string,
  entry: { date: string; description: string; type: FlowType },
  cents: number,
  contabil: { bankAccountId: string; counterAccountId: string; historyCode: number | null },
) {
  await tx
    .update(journalEntries)
    .set({ date: entry.date, description: entry.description, historyCode: contabil.historyCode })
    .where(eq(journalEntries.id, journalEntryId));
  await tx.delete(journalLines).where(eq(journalLines.entryId, journalEntryId));
  const lines = cashMirrorLines(isInflow(entry.type), cents, contabil);
  await tx.insert(journalLines).values(
    lines.map((l, i) => ({ entryId: journalEntryId, accountId: l.accountId, side: l.side, amount: centsToDecimal(l.cents), position: i })),
  );
}

export async function saveCashFlowEntry(input: z.input<typeof entrySchema>) {
  return companyAction(async ({ companyId, userId }) => {
    const parsed = entrySchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, cents, frequency, occurrences, contabil, ...data } = parsed.data;
    await assertPeriodOpen(companyId, data.date);
    // Só economia (aporte) e entrada (resgate) movimentam aplicações.
    if (data.type !== "economia" && data.type !== "entrada") data.investmentId = null;
    if (data.investmentId) {
      const [inv] = await db
        .select({ id: investments.id })
        .from(investments)
        .where(and(eq(investments.id, data.investmentId), eq(investments.companyId, companyId)));
      if (!inv) throw new UserError("Aplicação não encontrada.");
    }
    // A integração contábil cria um único lançamento; não faz sentido para várias ocorrências de uma vez.
    if (contabil && !id && frequency !== "unica") {
      throw new UserError("A integração com a contabilidade só está disponível para lançamentos únicos.");
    }
    if (contabil) await validateMirrorAccounts(companyId, contabil);

    const values = { ...data, amount: centsToDecimal(cents) };

    return db.transaction(async (tx) => {
      if (id) {
        const [current] = await tx
          .select({ journalEntryId: cashFlowEntries.journalEntryId })
          .from(cashFlowEntries)
          .where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)));
        if (!current) throw new UserError("Registro não encontrado.");
        // A edição altera só esta ocorrência; a frequência da série é mantida.
        await tx.update(cashFlowEntries).set(values).where(eq(cashFlowEntries.id, id));

        if (contabil === null && current.journalEntryId) {
          await tx.delete(journalEntries).where(eq(journalEntries.id, current.journalEntryId));
          await tx.update(cashFlowEntries).set({ journalEntryId: null }).where(eq(cashFlowEntries.id, id));
        } else if (contabil) {
          if (current.journalEntryId) {
            await syncLinkedEntry(tx, current.journalEntryId, data, cents, contabil);
          } else {
            const created = await createLinkedEntry(tx, companyId, userId, data, cents, contabil);
            await tx.update(cashFlowEntries).set({ journalEntryId: created.id }).where(eq(cashFlowEntries.id, id));
          }
        }
        revalidatePath("/financeiro", "layout");
        return { id };
      }

      const dates = occurrenceDates(data.date, frequency, frequency === "unica" ? 1 : occurrences);
      const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
      const inserted = await tx
        .insert(cashFlowEntries)
        .values(dates.map((date) => ({ ...values, date, frequency, seriesId, companyId, createdBy: userId })))
        .returning({ id: cashFlowEntries.id });

      if (contabil && inserted.length === 1) {
        const created = await createLinkedEntry(tx, companyId, userId, data, cents, contabil);
        await tx.update(cashFlowEntries).set({ journalEntryId: created.id }).where(eq(cashFlowEntries.id, inserted[0].id));
      }
      revalidatePath("/financeiro", "layout");
      return { id: inserted[0].id };
    });
  });
}

/** Remove só o vínculo contábil de uma movimentação (exclui o lançamento contábil criado a partir dela). */
export async function unlinkCashFlowAccounting(id: string) {
  return companyAction(async ({ companyId }) => {
    const [current] = await db
      .select({ journalEntryId: cashFlowEntries.journalEntryId, date: cashFlowEntries.date })
      .from(cashFlowEntries)
      .where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)));
    if (!current) throw new UserError("Registro não encontrado.");
    if (!current.journalEntryId) return;
    await assertPeriodOpen(companyId, current.date);
    await db.delete(journalEntries).where(eq(journalEntries.id, current.journalEntryId));
    await db.update(cashFlowEntries).set({ journalEntryId: null }).where(eq(cashFlowEntries.id, id));
    revalidatePath("/financeiro", "layout");
  });
}

async function deleteLinkedEntries(tx: Tx, rows: { journalEntryId: string | null }[]) {
  const ids = rows.map((r) => r.journalEntryId).filter((v): v is string => Boolean(v));
  if (ids.length > 0) await tx.delete(journalEntries).where(inArray(journalEntries.id, ids));
}

export async function deleteCashFlowEntry(id: string) {
  return companyAction(async ({ companyId }) => {
    const [current] = await db
      .select({ date: cashFlowEntries.date, journalEntryId: cashFlowEntries.journalEntryId })
      .from(cashFlowEntries)
      .where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)));
    if (!current) throw new UserError("Registro não encontrado.");
    await assertPeriodOpen(companyId, current.date);
    await db.transaction(async (tx) => {
      await tx.delete(cashFlowEntries).where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)));
      await deleteLinkedEntries(tx, [current]);
    });
    revalidatePath("/financeiro", "layout");
  });
}

export async function deleteCashFlowEntries(ids: string[]) {
  return companyAction(async ({ companyId }) => {
    if (ids.length === 0) return;
    const current = await db
      .select({ date: cashFlowEntries.date, journalEntryId: cashFlowEntries.journalEntryId })
      .from(cashFlowEntries)
      .where(and(inArray(cashFlowEntries.id, ids), eq(cashFlowEntries.companyId, companyId)));
    for (const e of current) await assertPeriodOpen(companyId, e.date);
    await db.transaction(async (tx) => {
      await tx.delete(cashFlowEntries).where(and(inArray(cashFlowEntries.id, ids), eq(cashFlowEntries.companyId, companyId)));
      await deleteLinkedEntries(tx, current);
    });
    revalidatePath("/financeiro", "layout");
  });
}

/** Exclui a ocorrência informada e as seguintes da mesma série recorrente. */
export async function deleteCashFlowSeriesFrom(id: string) {
  return companyAction(async ({ companyId }) => {
    const [current] = await db
      .select({ date: cashFlowEntries.date, seriesId: cashFlowEntries.seriesId })
      .from(cashFlowEntries)
      .where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)));
    if (!current) throw new UserError("Registro não encontrado.");
    if (!current.seriesId) throw new UserError("Esta movimentação não é recorrente.");
    const seriesId = current.seriesId;
    // As ocorrências excluídas são desta data em diante; basta checar a mais antiga.
    await assertPeriodOpen(companyId, current.date);
    const toRemove = await db
      .select({ journalEntryId: cashFlowEntries.journalEntryId })
      .from(cashFlowEntries)
      .where(and(eq(cashFlowEntries.companyId, companyId), eq(cashFlowEntries.seriesId, seriesId), gte(cashFlowEntries.date, current.date)));
    await db.transaction(async (tx) => {
      await tx
        .delete(cashFlowEntries)
        .where(and(eq(cashFlowEntries.companyId, companyId), eq(cashFlowEntries.seriesId, seriesId), gte(cashFlowEntries.date, current.date)));
      await deleteLinkedEntries(tx, toRemove);
    });
    revalidatePath("/financeiro", "layout");
  });
}
