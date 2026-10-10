import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { PageHeader } from "@/components/page-header";
import { accountName, EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { ReportFilters } from "@/components/report-filters";
import { AccountRow, AccountRowsGroup } from "@/components/report/interactive-rows";
import { type AccountGroup, formatReportBalance, formatReportMoney } from "@/lib/accounting";
import { getChart, getMovements, rollup } from "@/lib/data/ledger";
import { readPeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

const SUMMARY_GROUPS: { key: AccountGroup; label: string }[] = [
  { key: "ativo", label: "ATIVO" },
  { key: "passivo", label: "PASSIVO" },
  { key: "patrimonio_liquido", label: "PATRIMÔNIO LÍQUIDO" },
  { key: "receita", label: "RECEITAS" },
  { key: "despesa", label: "DESPESAS" },
];

/** Resultado do período em parênteses quando negativo (prejuízo), igual à DRE. */
const signedResult = (cents: number) => (cents < 0 ? `(${formatReportMoney(-cents)})` : formatReportMoney(cents));

export async function TrialBalanceReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);
  const showZero = params.zeradas === "1";
  const showSummary = params.resumo === "1";

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

  // Resumo por grupo: soma só as contas analíticas (folhas), para não contar duas vezes via as sintéticas.
  const groupSummary = SUMMARY_GROUPS.map(({ key, label }) => {
    const leaves = chart.filter((a) => a.analytic && a.group === key);
    const previous = leaves.reduce((s, a) => s + (prev.get(a.id)!.debit - prev.get(a.id)!.credit), 0);
    const debit = leaves.reduce((s, a) => s + mov.get(a.id)!.debit, 0);
    const credit = leaves.reduce((s, a) => s + mov.get(a.id)!.credit, 0);
    return { label, previous, debit, credit, current: previous + debit - credit };
  });
  const receitas = groupSummary.find((g) => g.label === "RECEITAS")!;
  const despesas = groupSummary.find((g) => g.label === "DESPESAS")!;
  const resultado = {
    label: "RESULTADO DO PERÍODO",
    previous: -receitas.previous - despesas.previous,
    debit: despesas.debit - despesas.credit,
    credit: receitas.credit - receitas.debit,
    current: -receitas.current - despesas.current,
  };

  return (
    <>
      <PageHeader title="Balancete de Verificação" />
      <ReportFilters period={period} showZeroOption showSummaryOption />
      <ReportSheet company={company} title="Balancete de Verificação" period={period}>
        {rows.length === 0 ? (
          <EmptyReport />
        ) : (
          <ReportTable>
            <thead>
              <tr>
                <Th className="w-16 text-right">ID</Th>
                <Th className="w-28">Classificação</Th>
                <Th>Descrição</Th>
                <Th className={num}>Saldo anterior</Th>
                <Th className={num}>Débito</Th>
                <Th className={num}>Crédito</Th>
                <Th className={num}>Saldo atual</Th>
              </tr>
            </thead>
            <tbody>
              <AccountRowsGroup period={period}>
                {rows.map((r) => (
                  <AccountRow
                    key={r.id}
                    accountId={r.id}
                    analytic={r.analytic}
                    className={cn("border-b border-border/60", !r.analytic && "font-semibold", r.level === 1 && "bg-muted/50")}
                  >
                    <td className="text-right tabular-nums text-muted-foreground">{r.reducedCode}</td>
                    <td className="tabular-nums">{r.classification}</td>
                    <td className={accountName} style={{ paddingLeft: `${(r.level - 1) * 1 + 0.5}rem` }}>{r.name}</td>
                    <td className={num}>{formatReportBalance(r.previous)}</td>
                    <td className={num}>{formatReportMoney(r.debit)}</td>
                    <td className={num}>{formatReportMoney(r.credit)}</td>
                    <td className={num}>{formatReportBalance(r.current)}</td>
                  </AccountRow>
                ))}
              </AccountRowsGroup>
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
        {showSummary && (
          <section className="mt-8 break-inside-avoid">
            <h3 className="mb-2 font-semibold uppercase">Resumo por grupo</h3>
            <ReportTable>
              <thead>
                <tr>
                  <Th>Grupo</Th>
                  <Th className={num}>Saldo anterior</Th>
                  <Th className={num}>Débito</Th>
                  <Th className={num}>Crédito</Th>
                  <Th className={num}>Saldo atual</Th>
                </tr>
              </thead>
              <tbody>
                {groupSummary.map((g) => (
                  <tr key={g.label} className="border-b border-border/60">
                    <td className="font-semibold">{g.label}</td>
                    <td className={num}>{formatReportBalance(g.previous)}</td>
                    <td className={num}>{formatReportMoney(g.debit)}</td>
                    <td className={num}>{formatReportMoney(g.credit)}</td>
                    <td className={num}>{formatReportBalance(g.current)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-foreground/70 font-bold">
                  <td>{resultado.label}</td>
                  <td className={num}>{signedResult(resultado.previous)}</td>
                  <td className={num}>{formatReportMoney(resultado.debit)}</td>
                  <td className={num}>{formatReportMoney(resultado.credit)}</td>
                  <td className={cn(num, resultado.current < 0 && "text-destructive")}>{signedResult(resultado.current)}</td>
                </tr>
              </tbody>
            </ReportTable>
          </section>
        )}
      </ReportSheet>
    </>
  );
}
