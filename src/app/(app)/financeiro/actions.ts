"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cashFlowEntries } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { companyAction, UserError } from "@/lib/action-utils";
import { assertPeriodOpen } from "@/lib/period-lock";

const entrySchema = z.object({
  id: z.uuid().optional(),
  date: z.iso.date("Informe a data."),
  type: z.enum(["entrada", "saida"]),
  description: z.string().trim().min(1, "Informe a descrição.").max(200),
  category: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null),
  cents: z.number().int().positive("O valor deve ser maior que zero."),
});

export async function saveCashFlowEntry(input: z.input<typeof entrySchema>) {
  return companyAction(async ({ companyId, userId }) => {
    const parsed = entrySchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, cents, ...data } = parsed.data;
    await assertPeriodOpen(companyId, data.date);
    const values = { ...data, amount: centsToDecimal(cents) };
    if (id) {
      const updated = await db
        .update(cashFlowEntries)
        .set(values)
        .where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)))
        .returning({ id: cashFlowEntries.id });
      if (updated.length === 0) throw new UserError("Registro não encontrado.");
    } else {
      await db.insert(cashFlowEntries).values({ ...values, companyId, createdBy: userId });
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
