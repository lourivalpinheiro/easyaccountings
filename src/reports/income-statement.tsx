import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { asc, eq } from "drizzle-orm";
import { Fragment } from "react";
import { PageHeader } from "@/components/page-header";
import { accountName, EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { ReportFilters } from "@/components/report-filters";
import { db } from "@/db";
import { dreCategories } from "@/db/schema";
import { formatReportMoney } from "@/lib/accounting";
import { getChart, getMovements } from "@/lib/data/ledger";
import { readPeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

/** Valor do resultado: positivo aumenta o lucro (receitas), negativo reduz (despesas). */
const signed = (cents: number) => (cents < 0 ? `(${formatReportMoney(-cents)})` : formatReportMoney(cents));

export async function IncomeStatementReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);

  const [chart, movements, categories] = await Promise.all([
    getChart(company.id),
    // Os lançamentos de zeramento são ignorados para não anular o resultado.
    getMovements(company.id, { from: period.from, to: period.to, excludeClosing: true }),
    db
      .select({ id: dreCategories.id, name: dreCategories.name })
      .from(dreCategories)
      .where(eq(dreCategories.companyId, company.id))
      .orderBy(asc(dreCategories.position)),
  ]);

  const resultAccounts = chart
    .filter((a) => a.analytic && (a.group === "despesa" || a.group === "receita"))
    .map((a) => {
      const m = movements.get(a.id);
      return { ...a, value: m ? m.credit - m.debit : 0 };
    })
    .filter((a) => a.value !== 0);

  const sections = [
    ...categories.map((c) => ({ id: c.id, name: c.name, accounts: resultAccounts.filter((a) => a.dreCategoryId === c.id) })),
    { id: "none", name: "CONTAS SEM CATEGORIA DE DRE", accounts: resultAccounts.filter((a) => !a.dreCategoryId) },
  ]
    .filter((s) => s.accounts.length > 0)
    .map((s) => ({ ...s, total: s.accounts.reduce((sum, a) => sum + a.value, 0) }));

  const revenues = resultAccounts.filter((a) => a.group === "receita").reduce((s, a) => s + a.value, 0);
  const expenses = resultAccounts.filter((a) => a.group === "despesa").reduce((s, a) => s + a.value, 0);
  const result = revenues + expenses;

  return (
    <>
      <PageHeader title="Demonstração do Resultado do Exercício" />
      <ReportFilters period={period} />
      <ReportSheet company={company} title="Demonstração do Resultado do Exercício (DRE)" period={period}>
        {sections.length === 0 ? (
          <EmptyReport>Nenhuma movimentação em contas de resultado no período.</EmptyReport>
        ) : (
          <ReportTable className="mx-auto max-w-3xl">
            <thead>
              <tr>
                <Th className="w-28">Classificação</Th>
                <Th>Descrição</Th>
                <Th className={num}>Valor</Th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <Fragment key={s.id}>
                  <tr className="bg-muted/50 font-semibold">
                    <td colSpan={3} className="!pt-3">
                      {s.name}
                    </td>
                  </tr>
                  {s.accounts.map((a) => (
                    <tr key={a.id} className="border-b border-border/40">
                      <td className="tabular-nums text-muted-foreground">{a.classification}</td>
                      <td className={cn("pl-4", accountName)}>{a.name}</td>
                      <td className={num}>{signed(a.value)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td />
                    <td className="text-right">Total {s.name}</td>
                    <td className={cn(num, "border-t border-foreground/50")}>{signed(s.total)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/70">
                <td />
                <td className="text-right">Total das receitas</td>
                <td className={num}>{signed(revenues)}</td>
              </tr>
              <tr>
                <td />
                <td className="text-right">Total das despesas</td>
                <td className={num}>{signed(expenses)}</td>
              </tr>
              <tr className={cn("text-base font-bold", result >= 0 ? "text-primary" : "text-destructive")}>
                <td />
                <td className="text-right">{result >= 0 ? "LUCRO LÍQUIDO DO PERÍODO" : "PREJUÍZO LÍQUIDO DO PERÍODO"}</td>
                <td className={cn(num, "border-t-2 border-double border-current")}>{formatReportMoney(Math.abs(result))}</td>
              </tr>
            </tfoot>
          </ReportTable>
        )}
      </ReportSheet>
    </>
  );
}
