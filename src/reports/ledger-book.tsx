import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { Fragment } from "react";
import { PageHeader } from "@/components/page-header";
import { EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { formatReportBalance, formatDate, formatReportMoney, isDescendantOrSelf } from "@/lib/accounting";
import { getChart, getMovements, rollup } from "@/lib/data/ledger";
import { getEntryLines, getLedgerLines, groupByDate } from "@/lib/data/reports";
import { readPeriod } from "@/lib/period";
import { LedgerFilters } from "@/app/(app)/relatorios/livro-razao/account-multi-select";

export async function LedgerBookReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);

  const chart = await getChart(company.id);
  const accountById = new Map(chart.map((a) => [a.id, a]));
  const selectedIds = (typeof params.contas === "string" ? params.contas.split(",") : []).filter((id) => accountById.has(id));
  const selected = selectedIds.map((id) => accountById.get(id)!);

  // Uma conta sintética reúne os lançamentos de todas as analíticas abaixo dela.
  const analyticsOf = (classification: string) =>
    chart.filter((a) => a.analytic && isDescendantOrSelf(a.classification, classification)).map((a) => a.id);
  const allAnalytics = [...new Set(selected.flatMap((a) => analyticsOf(a.classification)))];

  const [before, lines] = await Promise.all([
    getMovements(company.id, { before: period.from }),
    getLedgerLines(company.id, period, allAnalytics),
  ]);
  const previousByAccount = rollup(chart, before);
  const entryLines = await getEntryLines([...new Set(lines.map((l) => l.entryId))]);

  const counterpart = (entryId: string, side: "D" | "C") => {
    const others = entryLines.filter((l) => l.entryId === entryId && l.side !== side);
    if (others.length !== 1) return "Diversos";
    const acc = accountById.get(others[0].accountId);
    return acc ? `${acc.reducedCode} - ${acc.name}` : "";
  };

  const sections = selected.map((account) => {
    const ids = new Set(analyticsOf(account.classification));
    const p = previousByAccount.get(account.id)!;
    let balance = p.debit - p.credit;
    const previous = balance;
    const own = lines.filter((l) => ids.has(l.accountId));
    const days = groupByDate(own).map(([date, dayLines]) => {
      const rows = dayLines.map((l) => {
        balance += l.side === "D" ? l.cents : -l.cents;
        return { ...l, balance };
      });
      return {
        date,
        rows,
        debit: rows.filter((r) => r.side === "D").reduce((s, r) => s + r.cents, 0),
        credit: rows.filter((r) => r.side === "C").reduce((s, r) => s + r.cents, 0),
        balance,
      };
    });
    return {
      account,
      previous,
      days,
      debit: days.reduce((s, d) => s + d.debit, 0),
      credit: days.reduce((s, d) => s + d.credit, 0),
      final: balance,
    };
  });

  return (
    <>
      <PageHeader title="Livro Razão" />
      <LedgerFilters
        period={period}
        selected={selectedIds}
        accounts={chart.map(({ id, reducedCode, classification, name, analytic }) => ({ id, reducedCode, classification, name, analytic }))}
      />
      <ReportSheet company={company} title="Livro Razão" period={period}>
        {sections.length === 0 ? (
          <EmptyReport>Selecione uma ou mais contas e clique em Emitir.</EmptyReport>
        ) : (
          <div className="grid gap-8">
            {sections.map((s) => (
              <section key={s.account.id} className="break-inside-avoid-page">
                <h3 className="mb-2 rounded bg-primary/10 px-2 py-1.5 font-semibold">
                  Conta: {s.account.reducedCode} · {s.account.classification} - {s.account.name}
                </h3>
                <ReportTable>
                  <thead>
                    <tr>
                      <Th className="w-24">Data</Th>
                      <Th className="w-14 text-right">Nº</Th>
                      <Th>Histórico</Th>
                      <Th>Contrapartida</Th>
                      <Th className={num}>Débito</Th>
                      <Th className={num}>Crédito</Th>
                      <Th className={num}>Saldo</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-semibold">
                      <td colSpan={6}>Saldo anterior</td>
                      <td className={num}>{formatReportBalance(s.previous)}</td>
                    </tr>
                    {s.days.map((day) => (
                      <Fragment key={day.date}>
                        {day.rows.map((r, i) => (
                          <tr key={`${r.entryId}-${i}`} className={i === 0 ? "border-t-2 border-primary/30" : "border-t border-border/40"}>
                            <td>{i === 0 ? formatDate(r.date) : ""}</td>
                            <td className="text-right tabular-nums text-muted-foreground">{r.number}</td>
                            <td>
                              {r.historyCode ? `${r.historyCode} - ` : ""}
                              {r.description}
                            </td>
                            <td className="text-muted-foreground">{counterpart(r.entryId, r.side)}</td>
                            <td className={num}>{r.side === "D" ? formatReportMoney(r.cents) : ""}</td>
                            <td className={num}>{r.side === "C" ? formatReportMoney(r.cents) : ""}</td>
                            <td className={num}>{formatReportBalance(r.balance)}</td>
                          </tr>
                        ))}
                        <tr className="bg-muted/50 text-xs font-semibold">
                          <td colSpan={4} className="text-right">
                            Movimento do dia {formatDate(day.date)}
                          </td>
                          <td className={num}>{formatReportMoney(day.debit)}</td>
                          <td className={num}>{formatReportMoney(day.credit)}</td>
                          <td className={num}>{formatReportBalance(day.balance)}</td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-foreground/70 font-bold">
                      <td colSpan={4} className="text-right">
                        Totais do período / Saldo final
                      </td>
                      <td className={num}>{formatReportMoney(s.debit)}</td>
                      <td className={num}>{formatReportMoney(s.credit)}</td>
                      <td className={num}>{formatReportBalance(s.final)}</td>
                    </tr>
                  </tfoot>
                </ReportTable>
              </section>
            ))}
          </div>
        )}
      </ReportSheet>
    </>
  );
}
