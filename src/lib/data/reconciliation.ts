import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, bankStatements, bankTransactions, reconciliationRules } from "@/db/schema";

export async function getBankStatements(companyId: string) {
  return db
    .select({
      id: bankStatements.id,
      fileName: bankStatements.fileName,
      createdAt: bankStatements.createdAt,
      bankAccountName: accounts.name,
      bankAccountClassification: accounts.classification,
    })
    .from(bankStatements)
    .innerJoin(accounts, eq(accounts.id, bankStatements.bankAccountId))
    .where(eq(bankStatements.companyId, companyId))
    .orderBy(desc(bankStatements.createdAt));
}

/** Empresas pequenas: filtra em memória em vez de duas queries com OR/AND aninhados. */
async function transactionsWhere(companyId: string, reconciled: boolean) {
  const rows = await db
    .select({
      id: bankTransactions.id,
      date: bankTransactions.date,
      amountCents: bankTransactions.amountCents,
      description: bankTransactions.description,
      journalEntryId: bankTransactions.journalEntryId,
      cashFlowEntryId: bankTransactions.cashFlowEntryId,
      matchedByKnot: bankTransactions.matchedByKnot,
      bankAccountId: bankStatements.bankAccountId,
    })
    .from(bankTransactions)
    .innerJoin(bankStatements, eq(bankTransactions.statementId, bankStatements.id))
    .where(eq(bankStatements.companyId, companyId))
    .orderBy(desc(bankTransactions.date));
  // Contábil e financeiro podem ser conciliados em momentos diferentes: só sai de "pendente"
  // quando os dois já foram feitos (ou já sabidamente não vão ser, ver UI).
  return rows.filter((r) => (reconciled ? r.journalEntryId && r.cashFlowEntryId : !r.journalEntryId || !r.cashFlowEntryId));
}

export function getPendingTransactions(companyId: string) {
  return transactionsWhere(companyId, false);
}

export function getReconciledTransactions(companyId: string) {
  return transactionsWhere(companyId, true);
}

export async function getKnots(companyId: string) {
  const rows = await db
    .select({
      id: reconciliationRules.id,
      pattern: reconciliationRules.pattern,
      module: reconciliationRules.module,
      historyCode: reconciliationRules.historyCode,
      cashCategory: reconciliationRules.cashCategory,
      counterAccountId: reconciliationRules.counterAccountId,
      counterAccountName: accounts.name,
      counterAccountClassification: accounts.classification,
    })
    .from(reconciliationRules)
    .leftJoin(accounts, eq(accounts.id, reconciliationRules.counterAccountId))
    .where(eq(reconciliationRules.companyId, companyId))
    .orderBy(desc(reconciliationRules.updatedAt));
  return rows;
}

export async function getBankAccountCandidates(companyId: string) {
  return db
    .select({ id: accounts.id, classification: accounts.classification, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.companyId, companyId)))
    .orderBy(accounts.classification);
}
