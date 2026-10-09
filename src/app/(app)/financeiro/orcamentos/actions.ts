"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { budgetItems, budgets } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { companyAction, UserError } from "@/lib/action-utils";
import { getChart } from "@/lib/data/ledger";

const budgetSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, "Informe o nome do orçamento."),
    startDate: z.iso.date("Data inicial inválida."),
    endDate: z.iso.date("Data final inválida."),
    totalCents: z.number().int().nonnegative(),
    items: z.array(z.object({ accountId: z.uuid(), cents: z.number().int().nonnegative() })),
  })
  .refine((b) => b.startDate <= b.endDate, { message: "A data final deve ser posterior à inicial." });

export async function saveBudget(input: z.input<typeof budgetSchema>) {
  return companyAction(async ({ companyId }) => {
    const parsed = budgetSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const b = parsed.data;
    if (b.items.length === 0) throw new UserError("Inclua ao menos uma conta no orçamento.");
    if (new Set(b.items.map((i) => i.accountId)).size !== b.items.length) {
      throw new UserError("Há contas repetidas no orçamento.");
    }
    const chart = await getChart(companyId);
    if (b.items.some((i) => !chart.find((a) => a.id === i.accountId)?.analytic)) {
      throw new UserError("Somente contas analíticas podem ser orçadas.");
    }
    const sumItems = b.items.reduce((s, i) => s + i.cents, 0);
    if (sumItems !== b.totalCents) {
      throw new UserError("A soma dos valores das contas deve ser igual ao valor total do orçamento.");
    }
    const values = {
      name: b.name,
      startDate: b.startDate,
      endDate: b.endDate,
      totalAmount: centsToDecimal(b.totalCents),
    };
    await db.transaction(async (tx) => {
      let budgetId = b.id;
      if (budgetId) {
        await tx.update(budgets).set(values).where(and(eq(budgets.id, budgetId), eq(budgets.companyId, companyId)));
        await tx.delete(budgetItems).where(eq(budgetItems.budgetId, budgetId));
      } else {
        const [created] = await tx.insert(budgets).values({ ...values, companyId }).returning({ id: budgets.id });
        budgetId = created.id;
      }
      await tx
        .insert(budgetItems)
        .values(b.items.map((i) => ({ budgetId: budgetId!, accountId: i.accountId, amount: centsToDecimal(i.cents) })));
    });
    revalidatePath("/financeiro/orcamentos");
  });
}

export async function deleteBudget(id: string) {
  return companyAction(async ({ companyId }) => {
    await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.companyId, companyId)));
    revalidatePath("/financeiro/orcamentos");
  });
}

export async function deleteBudgets(ids: string[]) {
  return companyAction(async ({ companyId }) => {
    if (ids.length > 0) await db.delete(budgets).where(and(eq(budgets.companyId, companyId), inArray(budgets.id, ids)));
    revalidatePath("/financeiro/orcamentos");
  });
}
