import { and, asc, count, desc, eq, gte, ilike, isNotNull, lte, or, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { cashFlowEntries } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import { getCashBalanceBefore, getCashTotals } from "@/lib/data/cash-flow";
import { getPageContext } from "@/lib/page-context";
import { readPeriod } from "@/lib/period";
import { CashFlowClient } from "./cash-flow-client";

export const metadata: Metadata = { title: "Fluxo de caixa" };

export default async function CashFlowPage({ searchParams }: PageProps<"/financeiro/fluxo-de-caixa">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const params = await searchParams;
  const period = readPeriod(params);
  const pageSize = [10, 25, 50, 100].includes(Number(params.por)) ? Number(params.por) : 25;
  const page = Math.max(1, Math.floor(Number(params.pagina)) || 1);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const type = params.tipo === "entrada" || params.tipo === "saida" ? params.tipo : undefined;

  const filters: SQL[] = [
    eq(cashFlowEntries.companyId, company.id),
    gte(cashFlowEntries.date, period.from),
    lte(cashFlowEntries.date, period.to),
  ];
  if (type) filters.push(eq(cashFlowEntries.type, type));
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
      .orderBy(desc(cashFlowEntries.date), desc(cashFlowEntries.createdAt))
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

  return (
    <>
      <PageHeader title="Fluxo de caixa" description="Registro das entradas e saídas de dinheiro da empresa." />
      <CashFlowClient
        period={period}
        filters={{ q, type: type ?? "" }}
        paging={{ page, pageSize, total }}
        summary={{ previous, inflow: totals.inflow, outflow: totals.outflow }}
        categories={categories.map((c) => c.category!)}
        entries={rows.map((r) => ({
          id: r.id,
          date: r.date,
          type: r.type,
          description: r.description,
          category: r.category,
          cents: toCents(r.amount),
        }))}
      />
    </>
  );
}
