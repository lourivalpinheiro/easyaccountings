"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cashFlowEntries, journalEntries, provisions } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { companyAction, UserError } from "@/lib/action-utils";
import { insertEntry, validateMirrorAccounts } from "@/lib/data/entries";
import { assertPeriodOpen } from "@/lib/period-lock";

const PROVISION_TYPES = ["pagar", "receber"] as const;

const revalidate = () => revalidatePath("/financeiro/provisionamento", "layout");

const provisionSchema = z.object({
  id: z.uuid().optional(),
  type: z.enum(PROVISION_TYPES),
  description: z.string().trim().min(1, "Informe a descrição.").max(200),
  category: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null),
  dueDate: z.iso.date("Informe o vencimento."),
  cents: z.number().int().positive("O valor deve ser maior que zero."),
});

async function ownedPending(id: string, companyId: string) {
  const [row] = await db.select().from(provisions).where(and(eq(provisions.id, id), eq(provisions.companyId, companyId)));
  if (!row) throw new UserError("Registro não encontrado.");
  if (row.settledAt) throw new UserError("Estorne a baixa antes de alterar ou excluir este registro.");
  return row;
}

export async function saveProvision(input: z.input<typeof provisionSchema>) {
  return companyAction(async ({ companyId, userId }) => {
    const parsed = provisionSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, cents, ...data } = parsed.data;
    const values = { ...data, amount: centsToDecimal(cents) };
    if (id) {
      await ownedPending(id, companyId);
      await db.update(provisions).set(values).where(eq(provisions.id, id));
    } else {
      await db.insert(provisions).values({ ...values, companyId, createdBy: userId });
    }
    revalidate();
  });
}

export async function deleteProvision(id: string) {
  return companyAction(async ({ companyId }) => {
    await ownedPending(id, companyId);
    await db.delete(provisions).where(eq(provisions.id, id));
    revalidate();
  });
}

export async function deleteProvisions(ids: string[]) {
  return companyAction(async ({ companyId }) => {
    if (ids.length === 0) return;
    for (const id of ids) await ownedPending(id, companyId);
    await db.delete(provisions).where(and(inArray(provisions.id, ids), eq(provisions.companyId, companyId)));
    revalidate();
  });
}

const settleSchema = z.object({
  id: z.uuid(),
  date: z.iso.date("Informe a data da baixa."),
  debitAccountId: z.uuid("Selecione a conta débito."),
  creditAccountId: z.uuid("Selecione a conta crédito."),
  historyCode: z.number().int().positive().nullable().default(null),
  category: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null),
});

/** Baixa uma conta a pagar/receber: gera a movimentação de fluxo de caixa e o lançamento contábil correspondentes. */
export async function settleProvision(input: z.input<typeof settleSchema>) {
  return companyAction(async ({ companyId, userId }) => {
    const parsed = settleSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, date, debitAccountId, creditAccountId, historyCode, category } = parsed.data;

    const [row] = await db.select().from(provisions).where(and(eq(provisions.id, id), eq(provisions.companyId, companyId)));
    if (!row) throw new UserError("Registro não encontrado.");
    if (row.settledAt) throw new UserError("Esta conta já foi baixada.");

    await assertPeriodOpen(companyId, date);
    await validateMirrorAccounts(companyId, { bankAccountId: debitAccountId, counterAccountId: creditAccountId });
    const cents = Math.round(Number(row.amount) * 100);
    const inflow = row.type === "receber";

    await db.transaction(async (tx) => {
      const [cashFlowEntry] = await tx
        .insert(cashFlowEntries)
        .values({
          companyId,
          date,
          type: inflow ? "entrada" : "saida",
          description: row.description,
          category: category ?? row.category,
          amount: centsToDecimal(cents),
          createdBy: userId,
        })
        .returning({ id: cashFlowEntries.id });

      const journalEntry = await insertEntry(
        tx,
        { companyId, date, description: row.description, historyCode, createdBy: userId },
        [
          { accountId: debitAccountId, side: "D", cents },
          { accountId: creditAccountId, side: "C", cents },
        ],
      );

      await tx
        .update(cashFlowEntries)
        .set({ journalEntryId: journalEntry.id })
        .where(eq(cashFlowEntries.id, cashFlowEntry.id));

      await tx
        .update(provisions)
        .set({ settledAt: date, cashFlowEntryId: cashFlowEntry.id, journalEntryId: journalEntry.id })
        .where(eq(provisions.id, id));
    });

    revalidate();
    revalidatePath("/financeiro", "layout");
    revalidatePath("/", "layout");
  });
}

/** Desfaz a baixa: exclui a movimentação de caixa e o lançamento contábil gerados, voltando a conta para pendente. */
export async function unsettleProvision(id: string) {
  return companyAction(async ({ companyId }) => {
    const [row] = await db.select().from(provisions).where(and(eq(provisions.id, id), eq(provisions.companyId, companyId)));
    if (!row) throw new UserError("Registro não encontrado.");
    if (!row.settledAt) throw new UserError("Esta conta ainda não foi baixada.");
    await assertPeriodOpen(companyId, row.settledAt);

    await db.transaction(async (tx) => {
      await tx.update(provisions).set({ settledAt: null, cashFlowEntryId: null, journalEntryId: null }).where(eq(provisions.id, id));
      if (row.cashFlowEntryId) await tx.delete(cashFlowEntries).where(eq(cashFlowEntries.id, row.cashFlowEntryId));
      if (row.journalEntryId) await tx.delete(journalEntries).where(eq(journalEntries.id, row.journalEntryId));
    });

    revalidate();
    revalidatePath("/financeiro", "layout");
    revalidatePath("/", "layout");
  });
}
