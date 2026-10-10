import { and, asc, count, desc, eq, gte, ilike, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { historyCodes, journalEntries, provisions } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import { getChart } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { readPeriod } from "@/lib/period";
import { readTableParams } from "@/lib/table-controls";
import { filtersToSql, sortToSql } from "@/lib/table-sql";
import { PROVISION_COLUMNS } from "./columns";
import { ProvisionamentoClient } from "./provisionamento-client";

export const metadata: Metadata = { title: "Provisionamento" };

export default async function ProvisionamentoPage({ searchParams }: PageProps<"/financeiro/provisionamento">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const params = await searchParams;
  const period = readPeriod(params);
  const pageSize = [10, 25, 50, 100].includes(Number(params.por)) ? Number(params.por) : 25;
  const page = Math.max(1, Math.floor(Number(params.pagina)) || 1);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const table = readTableParams(params, PROVISION_COLUMNS);
  const statusExpr = sql<string>`case when ${provisions.settledAt} is null then 'pendente' else 'baixado' end`;
  const columnExprs = {
    dueDate: provisions.dueDate,
    description: provisions.description,
    category: provisions.category,
    type: provisions.type,
    amount: provisions.amount,
    status: statusExpr,
  };

  const filters: SQL[] = [
    eq(provisions.companyId, company.id),
    gte(provisions.dueDate, period.from),
    lte(provisions.dueDate, period.to),
  ];
  filters.push(...filtersToSql(PROVISION_COLUMNS, table.filters, columnExprs));
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(provisions.description, like), ilike(provisions.category, like))!);
  }
  const where = and(...filters);

  const [rows, [{ total }], categories, chart, histories] = await Promise.all([
    db
      .select({
        id: provisions.id,
        type: provisions.type,
        description: provisions.description,
        category: provisions.category,
        dueDate: provisions.dueDate,
        amount: provisions.amount,
        settledAt: provisions.settledAt,
        cashFlowEntryId: provisions.cashFlowEntryId,
        journalEntryId: provisions.journalEntryId,
        journalEntryNumber: journalEntries.number,
      })
      .from(provisions)
      .leftJoin(journalEntries, eq(journalEntries.id, provisions.journalEntryId))
      .where(where)
      .orderBy(...sortToSql(table.sort, columnExprs, [asc(provisions.dueDate), desc(provisions.createdAt)]))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(provisions).where(where),
    db
      .selectDistinct({ category: provisions.category })
      .from(provisions)
      .where(and(eq(provisions.companyId, company.id), isNotNull(provisions.category)))
      .orderBy(asc(provisions.category)),
    getChart(company.id),
    db
      .select({ code: historyCodes.code, description: historyCodes.description })
      .from(historyCodes)
      .where(eq(historyCodes.companyId, company.id))
      .orderBy(asc(historyCodes.code)),
  ]);

  return (
    <>
      <PageHeader
        title="Provisionamento"
        description="Contas a pagar e a receber. O fluxo de caixa e a contabilidade só recebem o lançamento quando a conta é baixada."
      />
      <ProvisionamentoClient
        period={period}
        query={q}
        table={table}
        paging={{ page, pageSize, total }}
        categories={categories.map((c) => c.category!)}
        accounts={chart.map(({ id, reducedCode, classification, name, analytic }) => ({ id, reducedCode, classification, name, analytic }))}
        histories={histories}
        provisions={rows.map((r) => ({
          id: r.id,
          type: r.type,
          description: r.description,
          category: r.category,
          dueDate: r.dueDate,
          cents: toCents(r.amount),
          settledAt: r.settledAt,
          cashFlowEntryId: r.cashFlowEntryId,
          journalEntryId: r.journalEntryId,
          journalEntryNumber: r.journalEntryNumber,
        }))}
      />
    </>
  );
}
