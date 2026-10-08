"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bankStatements, bankTransactions, cashFlowEntries, companies, journalEntries, reconciliationRules } from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { companyAction, run, UserError } from "@/lib/action-utils";
import { requireAdmin } from "@/lib/auth/session";
import { getActiveCompany } from "@/lib/company";
import { insertEntry } from "@/lib/data/entries";
import { getChart } from "@/lib/data/ledger";
import { normalizePattern, parseOfx } from "@/lib/ofx-parser";
import { assertPeriodOpen } from "@/lib/period-lock";
import { ANEXOS_BUCKET, deleteFile, randomStoragePath, uploadFile } from "@/lib/storage";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type ReconcileInput = {
  contabil?: { counterAccountId: string; historyCode: number | null };
  financeiro?: { category: string | null };
};

/** Cria o(s) lançamento(s) de uma transação do extrato e grava/atualiza o Knot correspondente. */
async function applyReconciliation(
  companyId: string,
  userId: string,
  txRow: { id: string; date: string; amountCents: number; description: string; bankAccountId: string },
  input: ReconcileInput,
  matchedByKnot: boolean,
) {
  if (!input.contabil && !input.financeiro) throw new UserError("Escolha ao menos uma conciliação (contábil ou financeira).");
  await assertPeriodOpen(companyId, txRow.date);

  const patch: { journalEntryId?: string; cashFlowEntryId?: string } = {};

  if (input.contabil) {
    const chart = await getChart(companyId);
    const counter = chart.find((a) => a.id === input.contabil!.counterAccountId);
    if (!counter) throw new UserError("Conta contábil inválida.");
    if (!counter.analytic) throw new UserError(`A conta ${counter.classification} é sintética e não recebe lançamentos.`);
    const abs = Math.abs(txRow.amountCents);
    const bankSide = txRow.amountCents > 0 ? "D" : "C";
    const counterSide = txRow.amountCents > 0 ? "C" : "D";
    const created = await db.transaction((tx) =>
      insertEntry(
        tx,
        { companyId, date: txRow.date, description: txRow.description, historyCode: input.contabil!.historyCode, createdBy: userId },
        [
          { accountId: txRow.bankAccountId, side: bankSide, cents: abs },
          { accountId: input.contabil!.counterAccountId, side: counterSide, cents: abs },
        ],
      ),
    );
    patch.journalEntryId = created.id;
  }

  if (input.financeiro) {
    const [created] = await db
      .insert(cashFlowEntries)
      .values({
        companyId,
        date: txRow.date,
        type: txRow.amountCents > 0 ? "entrada" : "saida",
        description: txRow.description,
        category: input.financeiro.category,
        amount: centsToDecimal(Math.abs(txRow.amountCents)),
        createdBy: userId,
      })
      .returning({ id: cashFlowEntries.id });
    patch.cashFlowEntryId = created.id;
  }

  await db.update(bankTransactions).set({ ...patch, matchedByKnot }).where(eq(bankTransactions.id, txRow.id));

  // Mescla com o Knot existente: contábil e financeiro agora podem ser conciliados em momentos
  // diferentes, então uma chamada só com um dos dois não pode apagar o que já foi aprendido do outro.
  const pattern = normalizePattern(txRow.description);
  const [existingRule] = await db
    .select()
    .from(reconciliationRules)
    .where(and(eq(reconciliationRules.companyId, companyId), eq(reconciliationRules.pattern, pattern)));
  const hasContabil = Boolean(input.contabil) || existingRule?.module === "contabil" || existingRule?.module === "ambos";
  const hasFinanceiro = Boolean(input.financeiro) || existingRule?.module === "financeiro" || existingRule?.module === "ambos";
  const ruleModule = hasContabil && hasFinanceiro ? "ambos" : hasContabil ? "contabil" : "financeiro";
  const counterAccountId = input.contabil ? input.contabil.counterAccountId : (existingRule?.counterAccountId ?? null);
  const historyCode = input.contabil ? input.contabil.historyCode : (existingRule?.historyCode ?? null);
  const cashCategory = input.financeiro ? input.financeiro.category : (existingRule?.cashCategory ?? null);

  await db
    .insert(reconciliationRules)
    .values({ companyId, pattern, module: ruleModule, counterAccountId, historyCode, cashCategory })
    .onConflictDoUpdate({
      target: [reconciliationRules.companyId, reconciliationRules.pattern],
      set: { module: ruleModule, counterAccountId, historyCode, cashCategory, updatedAt: new Date() },
    });
}

/** Aplica os Knots existentes às transações recém-importadas que baterem o padrão. */
async function autoMatchNewTransactions(companyId: string, userId: string, bankAccountId: string, ids: string[]) {
  if (ids.length === 0) return;
  const [rows, rules] = await Promise.all([
    db.select().from(bankTransactions).where(inArray(bankTransactions.id, ids)),
    db.select().from(reconciliationRules).where(eq(reconciliationRules.companyId, companyId)),
  ]);
  const ruleByPattern = new Map(rules.map((r) => [r.pattern, r]));
  for (const row of rows) {
    const rule = ruleByPattern.get(normalizePattern(row.description));
    if (!rule) continue;
    try {
      await applyReconciliation(
        companyId,
        userId,
        { id: row.id, date: row.date, amountCents: row.amountCents, description: row.description, bankAccountId },
        {
          contabil: rule.module !== "financeiro" && rule.counterAccountId ? { counterAccountId: rule.counterAccountId, historyCode: rule.historyCode } : undefined,
          financeiro: rule.module !== "contabil" ? { category: rule.cashCategory } : undefined,
        },
        true,
      );
    } catch {
      // Período fechado ou conta removida: deixa pendente para conciliação manual.
    }
  }
}

export async function importStatement(bankAccountId: string, formData: FormData) {
  return companyAction(async ({ companyId, userId }) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecione um arquivo OFX.");
    if (file.size > MAX_FILE_BYTES) throw new UserError("O arquivo deve ter até 10 MB.");

    const chart = await getChart(companyId);
    const bankAccount = chart.find((a) => a.id === bankAccountId);
    if (!bankAccount) throw new UserError("Conta bancária inválida.");
    if (!bankAccount.analytic) throw new UserError("A conta bancária precisa ser uma conta analítica.");

    const parsed = parseOfx(await file.arrayBuffer());
    if (parsed.transactions.length === 0) {
      throw new UserError("Nenhuma transação encontrada no arquivo. Confira se é um extrato OFX válido.");
    }

    const existing = await db
      .select({ fitId: bankTransactions.fitId })
      .from(bankTransactions)
      .innerJoin(bankStatements, eq(bankTransactions.statementId, bankStatements.id))
      .where(and(eq(bankStatements.companyId, companyId), eq(bankStatements.bankAccountId, bankAccountId)));
    const seen = new Set(existing.map((r) => r.fitId).filter((v): v is string => Boolean(v)));
    const fresh = parsed.transactions.filter((t) => !t.fitId || !seen.has(t.fitId));

    const path = randomStoragePath(`extratos/${companyId}`, file.name);
    await uploadFile(ANEXOS_BUCKET, path, file);

    const [statement] = await db
      .insert(bankStatements)
      .values({ companyId, bankAccountId, fileName: file.name, storagePath: path, importedBy: userId })
      .returning({ id: bankStatements.id });

    if (fresh.length > 0) {
      const inserted = await db
        .insert(bankTransactions)
        .values(fresh.map((t) => ({ statementId: statement.id, fitId: t.fitId, date: t.date, amountCents: t.cents, description: t.description })))
        .returning({ id: bankTransactions.id });
      await autoMatchNewTransactions(companyId, userId, bankAccountId, inserted.map((r) => r.id));
    }

    revalidatePath("/utilitarios/conciliacao");
    return { imported: fresh.length, skipped: parsed.transactions.length - fresh.length };
  });
}

export async function reconcileTransaction(id: string, input: ReconcileInput) {
  return companyAction(async ({ companyId, userId }) => {
    const [row] = await db
      .select({
        id: bankTransactions.id,
        date: bankTransactions.date,
        amountCents: bankTransactions.amountCents,
        description: bankTransactions.description,
        bankAccountId: bankStatements.bankAccountId,
        statementCompanyId: bankStatements.companyId,
      })
      .from(bankTransactions)
      .innerJoin(bankStatements, eq(bankTransactions.statementId, bankStatements.id))
      .where(eq(bankTransactions.id, id));
    if (!row || row.statementCompanyId !== companyId) throw new UserError("Transação não encontrada.");
    await applyReconciliation(companyId, userId, row, input, false);
    revalidatePath("/utilitarios/conciliacao");
  });
}

export async function undoReconciliation(id: string) {
  return companyAction(async ({ companyId }) => {
    const [row] = await db
      .select({
        journalEntryId: bankTransactions.journalEntryId,
        cashFlowEntryId: bankTransactions.cashFlowEntryId,
        companyId: bankStatements.companyId,
      })
      .from(bankTransactions)
      .innerJoin(bankStatements, eq(bankTransactions.statementId, bankStatements.id))
      .where(eq(bankTransactions.id, id));
    if (!row || row.companyId !== companyId) throw new UserError("Transação não encontrada.");
    if (row.journalEntryId) await db.delete(journalEntries).where(eq(journalEntries.id, row.journalEntryId));
    if (row.cashFlowEntryId) await db.delete(cashFlowEntries).where(eq(cashFlowEntries.id, row.cashFlowEntryId));
    await db
      .update(bankTransactions)
      .set({ journalEntryId: null, cashFlowEntryId: null, matchedByKnot: false })
      .where(eq(bankTransactions.id, id));
    revalidatePath("/utilitarios/conciliacao");
  });
}

/** Exclui um extrato importado inteiro, junto com os lançamentos contábeis/financeiros criados a partir dele. */
export async function deleteStatement(id: string) {
  return companyAction(async ({ companyId }) => {
    const [statement] = await db
      .select({ id: bankStatements.id, storagePath: bankStatements.storagePath })
      .from(bankStatements)
      .where(and(eq(bankStatements.id, id), eq(bankStatements.companyId, companyId)));
    if (!statement) throw new UserError("Extrato não encontrado.");

    const txs = await db
      .select({ journalEntryId: bankTransactions.journalEntryId, cashFlowEntryId: bankTransactions.cashFlowEntryId })
      .from(bankTransactions)
      .where(eq(bankTransactions.statementId, id));
    const journalIds = txs.map((t) => t.journalEntryId).filter((v): v is string => Boolean(v));
    const cashFlowIds = txs.map((t) => t.cashFlowEntryId).filter((v): v is string => Boolean(v));

    if (journalIds.length > 0) await db.delete(journalEntries).where(inArray(journalEntries.id, journalIds));
    if (cashFlowIds.length > 0) await db.delete(cashFlowEntries).where(inArray(cashFlowEntries.id, cashFlowIds));
    // bank_transactions é excluído em cascata junto com o extrato.
    await db.delete(bankStatements).where(eq(bankStatements.id, id));
    void deleteFile(ANEXOS_BUCKET, statement.storagePath).catch(() => {});

    revalidatePath("/utilitarios/conciliacao");
  });
}

export async function deleteKnot(id: string) {
  return companyAction(async ({ companyId }) => {
    await db.delete(reconciliationRules).where(and(eq(reconciliationRules.id, id), eq(reconciliationRules.companyId, companyId)));
    revalidatePath("/utilitarios/conciliacao");
  });
}

export async function setPeriodLock(date: string | null) {
  await requireAdmin();
  const company = await getActiveCompany();
  if (!company) return { ok: false as const, error: "Selecione uma empresa." };
  return run(async () => {
    await db.update(companies).set({ periodLockedUntil: date }).where(eq(companies.id, company.id));
    revalidatePath("/", "layout");
  });
}

export async function deleteBankTransactions(ids: string[]) {
  return companyAction(async ({ companyId }) => {
    if (ids.length === 0) return;
    const rows = await db
      .select({ id: bankTransactions.id, journalEntryId: bankTransactions.journalEntryId, cashFlowEntryId: bankTransactions.cashFlowEntryId, companyId: bankStatements.companyId })
      .from(bankTransactions)
      .innerJoin(bankStatements, eq(bankTransactions.statementId, bankStatements.id))
      .where(and(inArray(bankTransactions.id, ids), isNull(bankTransactions.journalEntryId), isNull(bankTransactions.cashFlowEntryId)));
    const ownIds = rows.filter((r) => r.companyId === companyId).map((r) => r.id);
    if (ownIds.length > 0) await db.delete(bankTransactions).where(inArray(bankTransactions.id, ownIds));
    revalidatePath("/utilitarios/conciliacao");
  });
}
