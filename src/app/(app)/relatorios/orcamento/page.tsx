import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { formatDate, formatMoney, toCents } from "@/lib/accounting";
import { getChart, getMovements } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { todayIso } from "@/lib/period";
import { cn } from "@/lib/utils";
import { BudgetFilters } from "./budget-filters";

export const metadata: Metadata = { title: "Orçado x Realizado" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function BudgetReportPage({ searchParams }: PageProps<"/relatorios/orcamento">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const params = await searchParams;

  const all = await db.query.budgets.findMany({
    where: eq(budgets.companyId, company.id),
    orderBy: desc(budgets.startDate),
    with: { items: true },
  });
  const budget = all.find((b) => b.id === params.orcamento) ?? all[0];

  if (!budget) {
    return (
      <>
        <PageHeader title="Orçado x Realizado" />
        <EmptyReport>Nenhum orçamento cadastrado. Cadastre em Arquivo &gt; Orçamentos.</EmptyReport>
      </>
    );
  }

  // Por padrão, do início do orçamento até hoje (ou o fim do orçamento, se já passou).
  const today = todayIso();
  const defaultTo = budget.endDate < today ? budget.endDate : today;
  const from = typeof params.de === "string" && ISO.test(params.de) && params.orcamento === budget.id ? params.de : budget.startDate;
  const to = typeof params.ate === "string" && ISO.test(params.ate) && params.orcamento === budget.id ? params.ate : defaultTo;
  const period = { from, to };

  const [chart, movements] = await Promise.all([
    getChart(company.id),
    getMovements(company.id, { from, to, excludeClosing: true }),
  ]);

  const rows = budget.items
    .map((item) => {
      const acc = chart.find((a) => a.id === item.accountId)!;
      const m = movements.get(item.accountId) ?? { debit: 0, credit: 0 };
      // Realizado no sentido da natureza da conta.
      const actual = acc.nature === "C" ? m.credit - m.debit : m.debit - m.credit;
      const planned = toCents(item.amount);
      return { acc, planned, actual, diff: planned - actual, pct: planned ? (actual / planned) * 100 : null };
    })
    .sort((a, b) => a.acc.classification.localeCompare(b.acc.classification, undefined, { numeric: true }));

  const planned = rows.reduce((s, r) => s + r.planned, 0);
  const actual = rows.reduce((s, r) => s + r.actual, 0);

  return (
    <>
      <PageHeader title="Orçado x Realizado" />
      <BudgetFilters
        budgets={all.map((b) => ({ id: b.id, name: b.name, startDate: b.startDate, endDate: b.endDate }))}
        budgetId={budget.id}
        period={period}
      />
      <ReportSheet company={company} title={`Orçado x Realizado - ${budget.name}`} period={period}>
        <p className="mb-3 text-sm text-muted-foreground">
          Vigência do orçamento: {formatDate(budget.startDate)} a {formatDate(budget.endDate)} · Valor total orçado:{" "}
          {formatMoney(toCents(budget.totalAmount))}
        </p>
        <ReportTable>
          <thead>
            <tr>
              <Th className="w-28">Classificação</Th>
              <Th>Conta</Th>
              <Th className={num}>Orçado</Th>
              <Th className={num}>Realizado</Th>
              <Th className={num}>Saldo do orçamento</Th>
              <Th className={cn(num, "w-40")}>% realizado</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.acc.id} className="border-b border-border/60">
                <td className="tabular-nums">{r.acc.classification}</td>
                <td>{r.acc.name}</td>
                <td className={num}>{formatMoney(r.planned)}</td>
                <td className={num}>{formatMoney(r.actual)}</td>
                <td className={cn(num, r.diff < 0 && "text-destructive")}>{formatMoney(r.diff)}</td>
                <td className={num}>
                  {r.pct === null ? (
                    "—"
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted print:hidden">
                        <div
                          className={cn("h-full", r.pct > 100 ? "bg-destructive" : "bg-primary")}
                          style={{ width: `${Math.min(r.pct, 100)}%` }}
                        />
                      </div>
                      {r.pct.toFixed(1).replace(".", ",")}%
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/70 font-bold">
              <td colSpan={2}>Total</td>
              <td className={num}>{formatMoney(planned)}</td>
              <td className={num}>{formatMoney(actual)}</td>
              <td className={cn(num, planned - actual < 0 && "text-destructive")}>{formatMoney(planned - actual)}</td>
              <td className={num}>{planned ? `${((actual / planned) * 100).toFixed(1).replace(".", ",")}%` : "—"}</td>
            </tr>
          </tfoot>
        </ReportTable>
      </ReportSheet>
    </>
  );
}
