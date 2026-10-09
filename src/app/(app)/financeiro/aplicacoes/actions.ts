"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { investments, investmentValuations } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { companyAction, UserError } from "@/lib/action-utils";
import { INVESTMENT_KINDS } from "@/lib/investment-types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const investmentSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome da aplicação.").max(120),
  kind: z.enum(INVESTMENT_KINDS),
  institution: optionalText(120),
  notes: optionalText(500),
  active: z.boolean(),
});

async function assertOwned(id: string, companyId: string) {
  const [row] = await db
    .select({ id: investments.id })
    .from(investments)
    .where(and(eq(investments.id, id), eq(investments.companyId, companyId)));
  if (!row) throw new UserError("Aplicação não encontrada.");
}

export async function saveInvestment(input: z.input<typeof investmentSchema>) {
  return companyAction(async ({ companyId }) => {
    const parsed = investmentSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, ...values } = parsed.data;
    if (id) {
      await assertOwned(id, companyId);
      await db.update(investments).set(values).where(eq(investments.id, id));
    } else {
      await db.insert(investments).values({ ...values, companyId });
    }
    revalidatePath("/financeiro", "layout");
  });
}

export async function deleteInvestments(ids: string[]) {
  return companyAction(async ({ companyId }) => {
    if (ids.length === 0) return;
    // As movimentações do fluxo de caixa continuam; apenas perdem o vínculo com a aplicação.
    await db.delete(investments).where(and(eq(investments.companyId, companyId), inArray(investments.id, ids)));
    revalidatePath("/financeiro", "layout");
  });
}

const valuationSchema = z.object({
  investmentId: z.uuid(),
  date: z.iso.date("Informe a data."),
  cents: z.number().int().nonnegative("O saldo não pode ser negativo."),
});

/** Informa o saldo da aplicação numa data (substitui o saldo já informado nessa data). */
export async function saveValuation(input: z.input<typeof valuationSchema>) {
  return companyAction(async ({ companyId }) => {
    const parsed = valuationSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { investmentId, date, cents } = parsed.data;
    await assertOwned(investmentId, companyId);
    await db
      .insert(investmentValuations)
      .values({ investmentId, date, balance: centsToDecimal(cents) })
      .onConflictDoUpdate({
        target: [investmentValuations.investmentId, investmentValuations.date],
        set: { balance: centsToDecimal(cents), updatedAt: new Date() },
      });
    revalidatePath("/financeiro", "layout");
  });
}

export async function deleteValuation(id: string) {
  return companyAction(async ({ companyId }) => {
    const [row] = await db
      .select({ id: investmentValuations.id })
      .from(investmentValuations)
      .innerJoin(investments, eq(investments.id, investmentValuations.investmentId))
      .where(and(eq(investmentValuations.id, id), eq(investments.companyId, companyId)));
    if (!row) throw new UserError("Saldo não encontrado.");
    await db.delete(investmentValuations).where(eq(investmentValuations.id, id));
    revalidatePath("/financeiro", "layout");
  });
}
