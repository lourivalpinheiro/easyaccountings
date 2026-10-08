"use server";

import { and, eq, like, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { accounts, budgetItems, budgets, explanatoryNotes, journalLines } from "@/db/schema";
import {
  centsToDecimal,
  groupOf,
  isAnalytic,
  isValidClassification,
  levelOf,
  MAX_LEVEL,
  parentOf,
} from "@/lib/accounting";
import { companyAction, UserError } from "@/lib/action-utils";
import { getChart, getGroupSettings } from "@/lib/data/ledger";
import { sanitizeNoteHtml } from "@/lib/sanitize";

// ---------- Plano de contas ----------

const accountSchema = z.object({
  id: z.uuid().optional(),
  classification: z.string().trim(),
  name: z.string().trim().min(1, "Informe a descrição da conta."),
  dreCategoryId: z.uuid().nullable(),
});

export async function saveAccount(input: z.input<typeof accountSchema>) {
  return companyAction(async ({ companyId }) => {
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const data = parsed.data;

    if (!isValidClassification(data.classification) || levelOf(data.classification) > MAX_LEVEL) {
      throw new UserError(`Classificação inválida. Use até ${MAX_LEVEL} graus, ex.: 1.1.1.01.`);
    }
    const [settings, chart] = await Promise.all([getGroupSettings(companyId), getChart(companyId)]);
    if (!groupOf(data.classification, settings)) {
      throw new UserError("A classificação não pertence a nenhum grupo configurado em Natureza das contas.");
    }
    const parent = parentOf(data.classification);
    if (parent && !chart.some((a) => a.classification === parent)) {
      throw new UserError(`Cadastre antes a conta sintética ${parent}.`);
    }
    const duplicate = chart.find((a) => a.classification === data.classification && a.id !== data.id);
    if (duplicate) throw new UserError(`A classificação ${data.classification} já é usada por "${duplicate.name}".`);

    if (!data.id) {
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"accounts:" + companyId}))`);
        const [{ next }] = await tx
          .select({ next: sql<number>`coalesce(max(${accounts.reducedCode}), 0) + 1` })
          .from(accounts)
          .where(eq(accounts.companyId, companyId));
        await tx.insert(accounts).values({
          companyId,
          reducedCode: Number(next),
          classification: data.classification,
          name: data.name,
          dreCategoryId: data.dreCategoryId,
        });
      });
    } else {
      const current = chart.find((a) => a.id === data.id);
      if (!current) throw new UserError("Conta não encontrada.");
      const moved = current.classification !== data.classification;
      if (moved && levelOf(current.classification) !== levelOf(data.classification)) {
        throw new UserError("A nova classificação deve manter o mesmo grau da conta.");
      }
      await db.transaction(async (tx) => {
        await tx
          .update(accounts)
          .set({ classification: data.classification, name: data.name, dreCategoryId: data.dreCategoryId })
          .where(and(eq(accounts.id, data.id!), eq(accounts.companyId, companyId)));
        if (moved && !isAnalytic(current.classification)) {
          // Leva junto as contas filhas da sintética reclassificada.
          const descendants = chart.filter((a) => a.classification.startsWith(`${current.classification}.`));
          for (const d of descendants) {
            const target = data.classification + d.classification.slice(current.classification.length);
            if (chart.some((a) => a.classification === target && !descendants.includes(a))) {
              throw new UserError(`A classificação ${target} já existe; reclassificação cancelada.`);
            }
          }
          // Prefixo temporário evita colisão no índice único durante a troca.
          await tx
            .update(accounts)
            .set({ classification: sql`'~' || ${accounts.classification}` })
            .where(and(eq(accounts.companyId, companyId), like(accounts.classification, `${current.classification}.%`)));
          for (const d of descendants) {
            await tx
              .update(accounts)
              .set({ classification: data.classification + d.classification.slice(current.classification.length) })
              .where(eq(accounts.id, d.id));
          }
        }
      });
    }
    revalidatePath("/", "layout");
  });
}

export async function deleteAccount(id: string) {
  return companyAction(async ({ companyId }) => {
    const chart = await getChart(companyId);
    const account = chart.find((a) => a.id === id);
    if (!account) throw new UserError("Conta não encontrada.");
    if (chart.some((a) => a.classification.startsWith(`${account.classification}.`))) {
      throw new UserError("Exclua antes as contas filhas desta conta sintética.");
    }
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(journalLines).where(eq(journalLines.accountId, id));
    if (Number(n) > 0) throw new UserError("A conta possui lançamentos e não pode ser excluída.");
    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.companyId, companyId)));
    revalidatePath("/", "layout");
  });
}

// ---------- Notas explicativas ----------

const noteSchema = z.object({
  id: z.uuid().optional(),
  number: z.number().int().positive("Número inválido."),
  title: z.string().trim().min(1, "Informe o título da nota."),
  content: z.string(),
  accountId: z.uuid().nullable(),
});

export async function saveNote(input: z.input<typeof noteSchema>) {
  return companyAction(async ({ companyId }) => {
    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, ...rest } = parsed.data;
    const data = { ...rest, content: sanitizeNoteHtml(rest.content) };
    let noteId = id;
    if (id) {
      await db
        .update(explanatoryNotes)
        .set(data)
        .where(and(eq(explanatoryNotes.id, id), eq(explanatoryNotes.companyId, companyId)));
    } else {
      const [created] = await db
        .insert(explanatoryNotes)
        .values({ ...data, companyId })
        .returning({ id: explanatoryNotes.id });
      noteId = created.id;
    }
    revalidatePath("/arquivo/notas-explicativas");
    revalidatePath("/relatorios/balanco-patrimonial");
    return { id: noteId! };
  });
}

export async function deleteNote(id: string) {
  return companyAction(async ({ companyId }) => {
    await db.delete(explanatoryNotes).where(and(eq(explanatoryNotes.id, id), eq(explanatoryNotes.companyId, companyId)));
    revalidatePath("/arquivo/notas-explicativas");
  });
}

// ---------- Orçamentos ----------

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
    revalidatePath("/arquivo/orcamentos");
  });
}

export async function deleteBudget(id: string) {
  return companyAction(async ({ companyId }) => {
    await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.companyId, companyId)));
    revalidatePath("/arquivo/orcamentos");
  });
}
