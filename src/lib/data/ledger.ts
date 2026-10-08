import "server-only";
import { and, asc, eq, gte, isNull, lt, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  accountGroupSettings,
  accounts,
  dreCategories,
  journalEntries,
  journalLines,
} from "@/db/schema";
import {
  compareClassification,
  groupOf,
  isAnalytic,
  isDescendantOrSelf,
  levelOf,
  type AccountGroup,
  type GroupSetting,
  type Nature,
} from "@/lib/accounting";

export async function getGroupSettings(companyId: string): Promise<GroupSetting[]> {
  return db
    .select({
      group: accountGroupSettings.group,
      nature: accountGroupSettings.nature,
      prefix: accountGroupSettings.prefix,
    })
    .from(accountGroupSettings)
    .where(eq(accountGroupSettings.companyId, companyId));
}

export type ChartAccount = {
  id: string;
  reducedCode: number;
  classification: string;
  name: string;
  level: number;
  analytic: boolean;
  group: AccountGroup | null;
  nature: Nature | null;
  dreCategoryId: string | null;
  dreCategoryName: string | null;
};

export async function getChart(companyId: string): Promise<ChartAccount[]> {
  const [settings, rows] = await Promise.all([
    getGroupSettings(companyId),
    db
      .select({
        id: accounts.id,
        reducedCode: accounts.reducedCode,
        classification: accounts.classification,
        name: accounts.name,
        dreCategoryId: accounts.dreCategoryId,
        dreCategoryName: dreCategories.name,
      })
      .from(accounts)
      .leftJoin(dreCategories, eq(dreCategories.id, accounts.dreCategoryId))
      .where(eq(accounts.companyId, companyId))
      .orderBy(asc(accounts.classification)),
  ]);
  return rows
    .map((r) => {
      const group = groupOf(r.classification, settings);
      return {
        ...r,
        level: levelOf(r.classification),
        analytic: isAnalytic(r.classification),
        group,
        nature: settings.find((s) => s.group === group)?.nature ?? null,
      };
    })
    .sort((a, b) => compareClassification(a.classification, b.classification));
}

export type Movement = { debit: number; credit: number };

type MovementFilter = {
  from?: string;
  to?: string;
  /** Somente lançamentos anteriores a esta data. */
  before?: string;
  excludeClosing?: boolean;
};

/** Débitos e créditos (em centavos) por conta analítica no período. */
export async function getMovements(companyId: string, filter: MovementFilter = {}) {
  const conditions: SQL[] = [eq(journalEntries.companyId, companyId)];
  if (filter.from) conditions.push(gte(journalEntries.date, filter.from));
  if (filter.to) conditions.push(lte(journalEntries.date, filter.to));
  if (filter.before) conditions.push(lt(journalEntries.date, filter.before));
  if (filter.excludeClosing) conditions.push(isNull(journalEntries.closingBatchId));

  const rows = await db
    .select({
      accountId: journalLines.accountId,
      debit: sql<string>`coalesce(sum(case when ${journalLines.side} = 'D' then ${journalLines.amount} end), 0)`,
      credit: sql<string>`coalesce(sum(case when ${journalLines.side} = 'C' then ${journalLines.amount} end), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(and(...conditions))
    .groupBy(journalLines.accountId);

  const map = new Map<string, Movement>();
  for (const r of rows) {
    map.set(r.accountId, {
      debit: Math.round(Number(r.debit) * 100),
      credit: Math.round(Number(r.credit) * 100),
    });
  }
  return map;
}

/** Soma os movimentos das analíticas em cada conta (sintéticas incluídas). */
export function rollup(chart: ChartAccount[], movements: Map<string, Movement>) {
  const analytics = chart.filter((a) => a.analytic);
  const result = new Map<string, Movement>();
  for (const account of chart) {
    if (account.analytic) {
      result.set(account.id, movements.get(account.id) ?? { debit: 0, credit: 0 });
      continue;
    }
    const total = { debit: 0, credit: 0 };
    for (const a of analytics) {
      if (isDescendantOrSelf(a.classification, account.classification)) {
        const m = movements.get(a.id);
        if (m) {
          total.debit += m.debit;
          total.credit += m.credit;
        }
      }
    }
    result.set(account.id, total);
  }
  return result;
}
