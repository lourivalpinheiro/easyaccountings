import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { PageHeader } from "@/components/page-header";
import { EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { ReportFilters } from "@/components/report-filters";
import { formatReportBalance, formatReportMoney } from "@/lib/accounting";
import { getChart, getMovements, rollup } from "@/lib/data/ledger";
import { readPeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

export async function TrialBalanceReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);
  const showZero = params.zeradas === "1";

  const [chart, before, inPeriod] = await Promise.all([
    getChart(company.id),
    getMovements(company.id, { before: period.from }),
    getMovements(company.id, { from: period.from, to: period.to }),
  ]);
  const prev = rollup(chart, before);
  const mov = rollup(chart, inPeriod);

  const rows = chart
    .map((a) => {
      const p = prev.get(a.id)!;
      const m = mov.get(a.id)!;
      const previous = p.debit - p.credit;
      return { ...a, previous, debit: m.debit, credit: m.credit, current: previous + m.debit - m.credit };
    })
    .filter((r) => showZero || r.previous !== 0 || r.debit !== 0 || r.credit !== 0);

  const analytic = rows.filter((r) => r.analytic);
  const totalD = analytic.reduce((s, r) => s + r.debit, 0);
  const totalC = analytic.reduce((s, r) => s + r.credit, 0);

  return (
    <>
      <PageHeader title="Balancete de Verificação" />
      <ReportFilters period={period} showZeroOption />
      <ReportSheet company={company} title="Balancete de Verificação" period={period}>
        {rows.length === 0 ? (
          <EmptyReport />
        ) : (
          <ReportTable>
            <thead>
              <tr>
                <Th className="w-16 text-right">Cód. reduzido</Th>
                <Th className="w-28">Classificação</Th>
                <Th>Descrição</Th>
                <Th className={num}>Saldo anterior</Th>
                <Th className={num}>Débito</Th>
                <Th className={num}>Crédito</Th>
                <Th className={num}>Saldo atual</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-b border-border/60", !r.analytic && "font-semibold", r.level === 1 && "bg-muted/50")}>
                  <td className="text-right tabular-nums text-muted-foreground">{r.reducedCode}</td>
                  <td className="tabular-nums">{r.classification}</td>
                  <td style={{ paddingLeft: `${(r.level - 1) * 1 + 0.5}rem` }}>{r.name}</td>
                  <td className={num}>{formatReportBalance(r.previous)}</td>
                  <td className={num}>{formatReportMoney(r.debit)}</td>
                  <td className={num}>{formatReportMoney(r.credit)}</td>
                  <td className={num}>{formatReportBalance(r.current)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/70 font-bold">
                <td colSpan={4}>Totais do período</td>
                <td className={num}>{formatReportMoney(totalD)}</td>
                <td className={num}>{formatReportMoney(totalC)}</td>
                <td className={cn(num, totalD !== totalC && "text-destructive")}>
                  {totalD === totalC ? "Conferido" : `Diferença ${formatReportMoney(Math.abs(totalD - totalC))}`}
                </td>
              </tr>
            </tfoot>
          </ReportTable>
        )}
      </ReportSheet>
    </>
  );
}
