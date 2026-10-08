"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cashFlowEntries } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { companyAction, UserError } from "@/lib/action-utils";

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
    await db
      .delete(cashFlowEntries)
      .where(and(eq(cashFlowEntries.id, id), eq(cashFlowEntries.companyId, companyId)));
    revalidatePath("/financeiro", "layout");
  });
}
