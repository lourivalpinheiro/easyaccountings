import { and, asc, count, desc, eq, gte, ilike, isNotNull, lte, or, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { cashFlowEntries } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import { getAttachmentsByCashFlowEntry } from "@/lib/data/attachments";
import { getCashBalanceBefore, getCashTotals } from "@/lib/data/cash-flow";
import { getPageContext } from "@/lib/page-context";
import { readPeriod } from "@/lib/period";
import { readTableParams } from "@/lib/table-controls";
import { filtersToSql, sortToSql } from "@/lib/table-sql";
import { CashFlowClient } from "./cash-flow-client";
import { CASH_FLOW_COLUMNS } from "./columns";

export const metadata: Metadata = { title: "Fluxo de caixa" };

export default async function CashFlowPage({ searchParams }: PageProps<"/financeiro/fluxo-de-caixa">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const params = await searchParams;
  const period = readPeriod(params);
  const pageSize = [10, 25, 50, 100].includes(Number(params.por)) ? Number(params.por) : 25;
  const page = Math.max(1, Math.floor(Number(params.pagina)) || 1);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const table = readTableParams(params, CASH_FLOW_COLUMNS);
  const columnExprs = {
    date: cashFlowEntries.date,
    description: cashFlowEntries.description,
    category: cashFlowEntries.category,
    type: cashFlowEntries.type,
    amount: cashFlowEntries.amount,
  };

  const filters: SQL[] = [
    eq(cashFlowEntries.companyId, company.id),
    gte(cashFlowEntries.date, period.from),
    lte(cashFlowEntries.date, period.to),
  ];
  filters.push(...filtersToSql(CASH_FLOW_COLUMNS, table.filters, columnExprs));
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(cashFlowEntries.description, like), ilike(cashFlowEntries.category, like))!);
  }
  const where = and(...filters);

  const [rows, [{ total }], totals, previous, categories] = await Promise.all([
    db
      .select()
      .from(cashFlowEntries)
      .where(where)
      .orderBy(...sortToSql(table.sort, columnExprs, [desc(cashFlowEntries.date), desc(cashFlowEntries.createdAt)]))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(cashFlowEntries).where(where),
    getCashTotals(company.id, period),
    getCashBalanceBefore(company.id, period.from),
    db
      .selectDistinct({ category: cashFlowEntries.category })
      .from(cashFlowEntries)
      .where(and(eq(cashFlowEntries.companyId, company.id), isNotNull(cashFlowEntries.category)))
      .orderBy(asc(cashFlowEntries.category)),
  ]);
  const attachmentsByEntry = await getAttachmentsByCashFlowEntry(rows.map((r) => r.id));

  return (
    <>
      <PageHeader title="Fluxo de caixa" description="Registro das entradas, saídas, economias e gastos no cartão de crédito." />
      <CashFlowClient
        period={period}
        query={q}
        table={table}
        paging={{ page, pageSize, total }}
        summary={{ previous, ...totals }}
        categories={categories.map((c) => c.category!)}
        entries={rows.map((r) => ({
          id: r.id,
          date: r.date,
          type: r.type,
          description: r.description,
          category: r.category,
          cents: toCents(r.amount),
          frequency: r.frequency,
          seriesId: r.seriesId,
          attachments: attachmentsByEntry.get(r.id) ?? [],
        }))}
      />
    </>
  );
}
