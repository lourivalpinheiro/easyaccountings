import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { Fragment } from "react";
import { PageHeader } from "@/components/page-header";
import { accountName, EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { ReportFilters } from "@/components/report-filters";
import { ClickableRow } from "@/components/report/interactive-rows";
import { formatReportBalance, formatDate, formatReportMoney } from "@/lib/accounting";
import { getChart, getMovements } from "@/lib/data/ledger";
import { getLedgerLines, groupByDate } from "@/lib/data/reports";
import { readPeriod } from "@/lib/period";

export async function JournalBookReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);

  const [chart, before, lines] = await Promise.all([
    getChart(company.id),
    getMovements(company.id, { before: period.from }),
    getLedgerLines(company.id, period),
  ]);
  const accountById = new Map(chart.map((a) => [a.id, a]));

  // Saldo corrente de cada conta, partindo do saldo anterior ao período.
  const running = new Map<string, number>();
  for (const [id, m] of before) running.set(id, m.debit - m.credit);

  const days = groupByDate(lines).map(([date, dayLines]) => {
    const rows = dayLines.map((l) => {
      const previous = running.get(l.accountId) ?? 0;
      const current = previous + (l.side === "D" ? l.cents : -l.cents);
      running.set(l.accountId, current);
      return { ...l, previous, current };
    });
    return {
      date,
      rows,
      debit: rows.filter((r) => r.side === "D").reduce((s, r) => s + r.cents, 0),
      credit: rows.filter((r) => r.side === "C").reduce((s, r) => s + r.cents, 0),
    };
  });
  const totalD = days.reduce((s, d) => s + d.debit, 0);
  const totalC = days.reduce((s, d) => s + d.credit, 0);

  return (
    <>
      <PageHeader title="Livro Diário" />
      <ReportFilters period={period} />
      <ReportSheet company={company} title="Livro Diário" period={period}>
        {days.length === 0 ? (
          <EmptyReport />
        ) : (
          <ReportTable>
            <thead>
              <tr>
                <Th className="w-14 text-right">Nº</Th>
                <Th>Conta</Th>
                <Th>Histórico</Th>
                <Th className={num}>Saldo anterior</Th>
                <Th className={num}>Débito</Th>
                <Th className={num}>Crédito</Th>
                <Th className={num}>Saldo final</Th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <Fragment key={day.date}>
                  <tr className="bg-primary/10 font-semibold break-inside-avoid">
                    <td colSpan={7} className="!pt-3">
                      {formatDate(day.date)}
                    </td>
                  </tr>
                  {day.rows.map((r, i) => {
                    const acc = accountById.get(r.accountId);
                    const firstOfEntry = i === 0 || day.rows[i - 1].entryId !== r.entryId;
                    return (
                      <ClickableRow
                        key={`${r.entryId}-${i}`}
                        href={`/movimento/lancamentos?de=${day.date}&ate=${day.date}&q=${r.number}&abrir=${r.entryId}`}
                        className={firstOfEntry ? "border-t border-border/60" : ""}
                      >
                        <td className="text-right tabular-nums text-muted-foreground">{firstOfEntry ? r.number : ""}</td>
                        <td className={accountName}>
                          <span className="tabular-nums text-muted-foreground">{acc?.reducedCode}</span> {acc?.classification} -{" "}
                          {acc?.name}
                        </td>
                        <td className="text-muted-foreground">
                          {firstOfEntry ? `${r.historyCode ? `${r.historyCode} - ` : ""}${r.description}` : ""}
                        </td>
                        <td className={num}>{formatReportBalance(r.previous)}</td>
                        <td className={num}>{r.side === "D" ? formatReportMoney(r.cents) : ""}</td>
                        <td className={num}>{r.side === "C" ? formatReportMoney(r.cents) : ""}</td>
                        <td className={num}>{formatReportBalance(r.current)}</td>
                      </ClickableRow>
                    );
                  })}
                  <tr className="border-t border-b-2 border-foreground/40 font-semibold">
                    <td colSpan={4} className="text-right">
                      Total do dia {formatDate(day.date)}
                    </td>
                    <td className={num}>{formatReportMoney(day.debit)}</td>
                    <td className={num}>{formatReportMoney(day.credit)}</td>
                    <td />
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/70 font-bold">
                <td colSpan={4} className="text-right">
                  Total do período
                </td>
                <td className={num}>{formatReportMoney(totalD)}</td>
                <td className={num}>{formatReportMoney(totalC)}</td>
                <td />
              </tr>
            </tfoot>
          </ReportTable>
        )}
      </ReportSheet>
    </>
  );
}
