"use server";

import { and, count, eq, gte, inArray, isNull, lte, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { cashFlowEntries, journalEntries } from "@/db/schema";
import { run, UserError } from "@/lib/action-utils";
import { requireAdmin } from "@/lib/auth/session";
import { getActiveCompany } from "@/lib/company";
import { assertPeriodOpenForDates } from "@/lib/period-lock";

const removeSchema = z.object({
  modules: z.array(z.enum(["contabil", "financeiro"])).min(1, "Selecione ao menos um módulo."),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

async function adminCompany() {
  const admin = await requireAdmin();
  const company = await getActiveCompany(admin);
  if (!company) throw new UserError("Selecione uma empresa.");
  return company;
}

function dateFilters(column: PgColumn, from: string | undefined, to: string | undefined): SQL[] {
  const filters: SQL[] = [];
  if (from) filters.push(gte(column, from));
  if (to) filters.push(lte(column, to));
  return filters;
}

export async function countRemovable(input: z.input<typeof removeSchema>) {
  return run(async () => {
    const company = await adminCompany();
    const parsed = removeSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { modules, from, to } = parsed.data;

    let contabil = 0;
    let contabilProtected = 0;
    if (modules.includes("contabil")) {
      const rows = await db
        .select({ closingBatchId: journalEntries.closingBatchId })
        .from(journalEntries)
        .where(and(eq(journalEntries.companyId, company.id), ...dateFilters(journalEntries.date, from, to)));
      contabilProtected = rows.filter((r) => r.closingBatchId).length;
      contabil = rows.length - contabilProtected;
    }

    let financeiro = 0;
    if (modules.includes("financeiro")) {
      const [row] = await db
        .select({ total: count() })
        .from(cashFlowEntries)
        .where(and(eq(cashFlowEntries.companyId, company.id), ...dateFilters(cashFlowEntries.date, from, to)));
      financeiro = row.total;
    }

    return { contabil, contabilProtected, financeiro };
  });
}

/** Exclui em massa lançamentos contábeis e/ou movimentações do fluxo de caixa. Lançamentos de zeramento nunca são excluídos aqui. */
export async function removeEntries(input: z.input<typeof removeSchema>) {
  return run(async () => {
    const company = await adminCompany();
    const parsed = removeSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { modules, from, to } = parsed.data;

    const result = await db.transaction(async (tx) => {
      let contabilDeleted = 0;
      let financeiroDeleted = 0;

      if (modules.includes("contabil")) {
        const rows = await tx
          .select({ id: journalEntries.id, date: journalEntries.date })
          .from(journalEntries)
          .where(
            and(
              eq(journalEntries.companyId, company.id),
              isNull(journalEntries.closingBatchId),
              ...dateFilters(journalEntries.date, from, to),
            ),
          );
        await assertPeriodOpenForDates(company.id, rows.map((r) => r.date));
        const ids = rows.map((r) => r.id);
        if (ids.length > 0) {
          await tx.delete(journalEntries).where(inArray(journalEntries.id, ids));
          contabilDeleted = ids.length;
        }
      }

      if (modules.includes("financeiro")) {
        const rows = await tx
          .select({ id: cashFlowEntries.id, date: cashFlowEntries.date, journalEntryId: cashFlowEntries.journalEntryId })
          .from(cashFlowEntries)
          .where(and(eq(cashFlowEntries.companyId, company.id), ...dateFilters(cashFlowEntries.date, from, to)));
        await assertPeriodOpenForDates(company.id, rows.map((r) => r.date));
        const ids = rows.map((r) => r.id);
        if (ids.length > 0) {
          await tx.delete(cashFlowEntries).where(inArray(cashFlowEntries.id, ids));
          financeiroDeleted = ids.length;
          // Movimentações com integração contábil que não tenham sido apagadas pelo módulo "contabil" acima.
          const linkedIds = rows.map((r) => r.journalEntryId).filter((v): v is string => Boolean(v));
          if (linkedIds.length > 0) await tx.delete(journalEntries).where(inArray(journalEntries.id, linkedIds));
        }
      }

      return { contabilDeleted, financeiroDeleted };
    });

    revalidatePath("/", "layout");
    return result;
  });
}
