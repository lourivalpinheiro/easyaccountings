"use server";

import { and, eq, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cashFlowEntries, investments } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { FLOW_TYPES, FREQUENCIES, MAX_OCCURRENCES, occurrenceDates } from "@/lib/cash-flow-types";
import { companyAction, UserError } from "@/lib/action-utils";
import { assertPeriodOpen } from "@/lib/period-lock";

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
});

export async function saveCashFlowEntry(input: z.input<typeof entrySchema>) {
  return companyAction(async ({ companyId, userId }) => {
    const parsed = entrySchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, cents, frequency, occurrences, ...data } = parsed.data;
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
    const values = { ...data, amount: centsToDecimal(cents) };
    if (id) {
      // A edição altera só esta ocorrência; a frequência da série é mantida.
      const updated = await db
        .update(cashFlowEntries)
        .set(values)
        .where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)))
        .returning({ id: cashFlowEntries.id });
      if (updated.length === 0) throw new UserError("Registro não encontrado.");
    } else {
      const dates = occurrenceDates(data.date, frequency, frequency === "unica" ? 1 : occurrences);
      const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
      await db
        .insert(cashFlowEntries)
        .values(dates.map((date) => ({ ...values, date, frequency, seriesId, companyId, createdBy: userId })));
    }
    revalidatePath("/financeiro", "layout");
  });
}

export async function deleteCashFlowEntry(id: string) {
  return companyAction(async ({ companyId }) => {
    const [current] = await db
      .select({ date: cashFlowEntries.date })
      .from(cashFlowEntries)
      .where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)));
    if (!current) throw new UserError("Registro não encontrado.");
    await assertPeriodOpen(companyId, current.date);
    await db
      .delete(cashFlowEntries)
      .where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)));
    revalidatePath("/financeiro", "layout");
  });
}

export async function deleteCashFlowEntries(ids: string[]) {
  return companyAction(async ({ companyId }) => {
    if (ids.length === 0) return;
    const current = await db
      .select({ date: cashFlowEntries.date })
      .from(cashFlowEntries)
      .where(and(inArray(cashFlowEntries.id, ids), eq(cashFlowEntries.companyId, companyId)));
    for (const e of current) await assertPeriodOpen(companyId, e.date);
    await db.delete(cashFlowEntries).where(and(inArray(cashFlowEntries.id, ids), eq(cashFlowEntries.companyId, companyId)));
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
    // As ocorrências excluídas são desta data em diante; basta checar a mais antiga.
    await assertPeriodOpen(companyId, current.date);
    await db
      .delete(cashFlowEntries)
      .where(
        and(
          eq(cashFlowEntries.companyId, companyId),
          eq(cashFlowEntries.seriesId, current.seriesId),
          gte(cashFlowEntries.date, current.date),
        ),
      );
    revalidatePath("/financeiro", "layout");
  });
}
