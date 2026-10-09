import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { Fragment } from "react";
import { PageHeader } from "@/components/page-header";
import { EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { ReportFilters } from "@/components/report-filters";
import { db } from "@/db";
import { cashFlowEntries } from "@/db/schema";
import { formatDate, formatReportMoney, toCents } from "@/lib/accounting";
import { FLOW_TYPE_LABELS, isInflow, signedCents } from "@/lib/cash-flow-types";
import { getCashBalanceBefore } from "@/lib/data/cash-flow";
import { groupByDate } from "@/lib/data/reports";
import { readPeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

/** Saldo com sinal: negativo indica caixa a descoberto. */
const balance = (cents: number) => (cents < 0 ? `-${formatReportMoney(-cents)}` : formatReportMoney(cents));

export async function CashFlowReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);

  const [previous, rows] = await Promise.all([
    getCashBalanceBefore(company.id, period.from),
    db
      .select()
      .from(cashFlowEntries)
      .where(
        and(
          eq(cashFlowEntries.companyId, company.id),
          gte(cashFlowEntries.date, period.from),
          lte(cashFlowEntries.date, period.to),
        ),
      )
      .orderBy(asc(cashFlowEntries.date), asc(cashFlowEntries.createdAt)),
  ]);

  // Saldo acumulado linha a linha, partindo do saldo anterior ao período.
  let running = previous;
  const withBalance = [];
  for (const r of rows) {
    const cents = toCents(r.amount);
    running += signedCents(r.type, cents);
    withBalance.push({ ...r, cents, balance: running });
  }
  const days = groupByDate(withBalance).map(([date, lines]) => ({
    date,
    lines,
    inflow: lines.filter((l) => isInflow(l.type)).reduce((s, l) => s + l.cents, 0),
    outflow: lines.filter((l) => !isInflow(l.type)).reduce((s, l) => s + l.cents, 0),
    balance: lines[lines.length - 1].balance,
  }));
  const inflow = days.reduce((s, d) => s + d.inflow, 0);
  const outflow = days.reduce((s, d) => s + d.outflow, 0);

  const byCategory = new Map<string, { inflow: number; outflow: number }>();
  for (const d of days) {
    for (const l of d.lines) {
      const key = l.category ?? "Sem categoria";
      const acc = byCategory.get(key) ?? { inflow: 0, outflow: 0 };
      if (isInflow(l.type)) acc.inflow += l.cents;
      else acc.outflow += l.cents;
      byCategory.set(key, acc);
    }
  }
  const categories = [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

  return (
    <>
      <PageHeader title="Relatório de fluxo de caixa" />
      <ReportFilters period={period} />
      <ReportSheet company={company} title="Fluxo de Caixa" period={period}>
        {days.length === 0 ? (
          <EmptyReport>Nenhuma movimentação no período. Saldo do caixa: {balance(previous)}.</EmptyReport>
        ) : (
          <>
            <ReportTable>
              <thead>
                <tr>
                  <Th className="w-24">Data</Th>
                  <Th>Descrição</Th>
                  <Th>Categoria</Th>
                  <Th className={num}>Entrada</Th>
                  <Th className={num}>Saída</Th>
                  <Th className={num}>Saldo</Th>
                </tr>
              </thead>
              <tbody>
                <tr className="font-semibold">
                  <td colSpan={5}>Saldo anterior</td>
                  <td className={num}>{balance(previous)}</td>
                </tr>
                {days.map((day) => (
                  <Fragment key={day.date}>
                    {day.lines.map((l, i) => (
                      <tr key={l.id} className={i === 0 ? "border-t-2 border-primary/30" : "border-t border-border/40"}>
                        <td>{i === 0 ? formatDate(l.date) : ""}</td>
                        <td>
                          {l.description}
                          {l.type !== "entrada" && l.type !== "saida" && (
                            <span className="text-muted-foreground"> ({FLOW_TYPE_LABELS[l.type].singular})</span>
                          )}
                        </td>
                        <td className="text-muted-foreground">{l.category ?? ""}</td>
                        <td className={num}>{isInflow(l.type) ? formatReportMoney(l.cents) : ""}</td>
                        <td className={num}>{!isInflow(l.type) ? formatReportMoney(l.cents) : ""}</td>
                        <td className={cn(num, l.balance < 0 && "text-destructive")}>{balance(l.balance)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 text-xs font-semibold">
                      <td colSpan={3} className="text-right">
                        Movimento do dia {formatDate(day.date)}
                      </td>
                      <td className={num}>{formatReportMoney(day.inflow)}</td>
                      <td className={num}>{formatReportMoney(day.outflow)}</td>
                      <td className={num}>{balance(day.balance)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/70 font-bold">
                  <td colSpan={3} className="text-right">
                    Totais do período / Saldo final
                  </td>
                  <td className={num}>{formatReportMoney(inflow)}</td>
                  <td className={num}>{formatReportMoney(outflow)}</td>
                  <td className={cn(num, running < 0 && "text-destructive")}>{balance(running)}</td>
                </tr>
              </tfoot>
            </ReportTable>

            <section className="mt-8 break-inside-avoid">
              <h3 className="mb-2 font-semibold uppercase">Resumo por categoria</h3>
              <ReportTable className="max-w-2xl">
                <thead>
                  <tr>
                    <Th>Categoria</Th>
                    <Th className={num}>Entradas</Th>
                    <Th className={num}>Saídas</Th>
                    <Th className={num}>Resultado</Th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(([name, v]) => (
                    <tr key={name} className="border-b border-border/60">
                      <td>{name}</td>
                      <td className={num}>{formatReportMoney(v.inflow)}</td>
                      <td className={num}>{formatReportMoney(v.outflow)}</td>
                      <td className={cn(num, v.inflow - v.outflow < 0 && "text-destructive")}>{balance(v.inflow - v.outflow)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/70 font-bold">
                    <td>Resultado do período</td>
                    <td className={num}>{formatReportMoney(inflow)}</td>
                    <td className={num}>{formatReportMoney(outflow)}</td>
                    <td className={cn(num, inflow - outflow < 0 && "text-destructive")}>{balance(inflow - outflow)}</td>
                  </tr>
                </tfoot>
              </ReportTable>
            </section>
          </>
        )}
      </ReportSheet>
    </>
  );
}
