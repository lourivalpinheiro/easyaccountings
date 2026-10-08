"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  accountGroupSettings,
  closingBatches,
  closingSettings,
  dreCategories,
  historyCodes,
} from "@/db/schema";
import { isValidClassification, type AccountGroup } from "@/lib/accounting";
import { companyAction, UserError } from "@/lib/action-utils";
import { getChart, getMovements } from "@/lib/data/ledger";
import { insertEntry, type LineInput } from "@/lib/data/entries";

// ---------- Natureza das contas ----------

const groupSettingsSchema = z.array(
  z.object({
    group: z.enum(["ativo", "passivo", "patrimonio_liquido", "despesa", "receita", "apuracao"]),
    nature: z.enum(["D", "C"]).nullable(),
    prefix: z.string().trim(),
  }),
);

export async function saveGroupSettings(input: z.input<typeof groupSettingsSchema>) {
  return companyAction(async ({ companyId }) => {
    const data = groupSettingsSchema.parse(input);
    const prefixes = new Set<string>();
    for (const s of data) {
      if (!isValidClassification(s.prefix)) throw new UserError(`Numeração inicial inválida: "${s.prefix}".`);
      if (prefixes.has(s.prefix)) throw new UserError(`Numeração "${s.prefix}" repetida.`);
      prefixes.add(s.prefix);
    }
    await db.transaction(async (tx) => {
      for (const s of data) {
        await tx
          .update(accountGroupSettings)
          .set({ nature: s.group === "apuracao" ? null : s.nature, prefix: s.prefix })
          .where(and(eq(accountGroupSettings.companyId, companyId), eq(accountGroupSettings.group, s.group)));
      }
    });
    revalidatePath("/", "layout");
  });
}

// ---------- Categorias de DRE ----------

export async function saveDreCategory(input: { id?: string; name: string; position: number }) {
  return companyAction(async ({ companyId }) => {
    const name = input.name.trim().toUpperCase();
    if (!name) throw new UserError("Informe o nome da categoria.");
    if (input.id) {
      await db
        .update(dreCategories)
        .set({ name, position: input.position })
        .where(and(eq(dreCategories.id, input.id), eq(dreCategories.companyId, companyId)));
      revalidatePath("/", "layout");
      return { id: input.id, name };
    }
    const [created] = await db
      .insert(dreCategories)
      .values({ companyId, name, position: input.position })
      .returning({ id: dreCategories.id, name: dreCategories.name });
    revalidatePath("/", "layout");
    return created;
  });
}

export async function reorderDreCategories(ids: string[]) {
  return companyAction(async ({ companyId }) => {
    await db.transaction(async (tx) => {
      for (const [i, id] of ids.entries()) {
        await tx
          .update(dreCategories)
          .set({ position: i + 1 })
          .where(and(eq(dreCategories.id, id), eq(dreCategories.companyId, companyId)));
      }
    });
    revalidatePath("/", "layout");
  });
}

export async function deleteDreCategory(id: string) {
  return companyAction(async ({ companyId }) => {
    await db.delete(dreCategories).where(and(eq(dreCategories.id, id), eq(dreCategories.companyId, companyId)));
    revalidatePath("/", "layout");
  });
}

// ---------- Históricos padrão ----------

export async function saveHistoryCode(input: { id?: string; code: number; description: string }) {
  return companyAction(async ({ companyId }) => {
    const description = input.description.trim();
    if (!Number.isInteger(input.code) || input.code <= 0) throw new UserError("Código inválido.");
    if (!description) throw new UserError("Informe a descrição.");
    if (input.id) {
      await db
        .update(historyCodes)
        .set({ code: input.code, description })
        .where(and(eq(historyCodes.id, input.id), eq(historyCodes.companyId, companyId)));
    } else {
      await db.insert(historyCodes).values({ companyId, code: input.code, description });
    }
    revalidatePath("/", "layout");
  });
}

export async function deleteHistoryCode(id: string) {
  return companyAction(async ({ companyId }) => {
    await db.delete(historyCodes).where(and(eq(historyCodes.id, id), eq(historyCodes.companyId, companyId)));
    revalidatePath("/", "layout");
  });
}

// ---------- Zeramento ----------

export async function saveClosingSettings(input: {
  resultAccountId: string | null;
  profitAccountId: string | null;
  lossAccountId: string | null;
}) {
  return companyAction(async ({ companyId }) => {
    const chart = await getChart(companyId);
    const check = (id: string | null, group: AccountGroup, label: string) => {
      if (!id) return;
      const acc = chart.find((a) => a.id === id);
      if (!acc || !acc.analytic || acc.group !== group) {
        throw new UserError(`A conta de ${label} deve ser analítica do grupo correto.`);
      }
    };
    check(input.resultAccountId, "apuracao", "apuração");
    check(input.profitAccountId, "patrimonio_liquido", "lucros");
    check(input.lossAccountId, "patrimonio_liquido", "prejuízos");
    await db
      .insert(closingSettings)
      .values({ companyId, ...input })
      .onConflictDoUpdate({ target: closingSettings.companyId, set: input });
    revalidatePath("/parametros/zeramento");
  });
}

const closingSchema = z
  .object({ startDate: z.iso.date(), endDate: z.iso.date() })
  .refine((d) => d.startDate <= d.endDate, { message: "Período inválido." });

export async function runClosing(input: { startDate: string; endDate: string }) {
  return companyAction(async ({ companyId, userId }) => {
    const parsed = closingSchema.safeParse(input);
    if (!parsed.success) throw new UserError("Informe um período válido.");
    const { startDate, endDate } = parsed.data;

    const [settings] = await db.select().from(closingSettings).where(eq(closingSettings.companyId, companyId));
    if (!settings?.resultAccountId || !settings.profitAccountId || !settings.lossAccountId) {
      throw new UserError("Defina as contas de apuração, lucros e prejuízos antes de executar o zeramento.");
    }

    const [chart, movements] = await Promise.all([
      getChart(companyId),
      getMovements(companyId, { from: startDate, to: endDate }),
    ]);

    const groupLines = (group: "despesa" | "receita") => {
      const lines: LineInput[] = [];
      let net = 0;
      for (const acc of chart) {
        if (!acc.analytic || acc.group !== group) continue;
        const m = movements.get(acc.id);
        const balance = m ? m.debit - m.credit : 0;
        if (balance === 0) continue;
        // Lançamento contrário ao saldo para zerar a conta.
        lines.push({ accountId: acc.id, side: balance > 0 ? "C" : "D", cents: Math.abs(balance) });
        net += balance;
      }
      if (net !== 0) {
        lines.push({ accountId: settings.resultAccountId!, side: net > 0 ? "D" : "C", cents: Math.abs(net) });
      }
      return { lines, net };
    };

    const expenses = groupLines("despesa");
    const revenues = groupLines("receita");
    if (expenses.lines.length === 0 && revenues.lines.length === 0) {
      throw new UserError("Não há saldo nas contas de resultado neste período.");
    }
    // Saldo da apuração: devedor = prejuízo, credor = lucro.
    const result = expenses.net + revenues.net;

    return db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(closingBatches)
        .values({ companyId, startDate, endDate, netResult: (-result / 100).toFixed(2), createdBy: userId })
        .returning({ id: closingBatches.id });
      const base = { companyId, date: endDate, closingBatchId: batch.id, createdBy: userId };

      if (expenses.lines.length) {
        await insertEntry(tx, { ...base, description: "Zeramento das contas de despesa" }, expenses.lines);
      }
      if (revenues.lines.length) {
        await insertEntry(tx, { ...base, description: "Zeramento das contas de receita" }, revenues.lines);
      }
      if (result !== 0) {
        const profit = result < 0;
        await insertEntry(
          tx,
          { ...base, description: profit ? "Transferência do lucro do exercício" : "Transferência do prejuízo do exercício" },
          profit
            ? [
                { accountId: settings.resultAccountId!, side: "D", cents: -result },
                { accountId: settings.profitAccountId!, side: "C", cents: -result },
              ]
            : [
                { accountId: settings.lossAccountId!, side: "D", cents: result },
                { accountId: settings.resultAccountId!, side: "C", cents: result },
              ],
        );
      }
      revalidatePath("/", "layout");
      return { result: -result };
    });
  });
}

export async function revertClosing(batchId: string) {
  return companyAction(async ({ companyId }) => {
    // Os lançamentos do lote são excluídos em cascata.
    await db
      .delete(closingBatches)
      .where(and(eq(closingBatches.id, batchId), eq(closingBatches.companyId, companyId)));
    revalidatePath("/", "layout");
  });
}

