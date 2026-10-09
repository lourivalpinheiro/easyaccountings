import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { InteractiveChart } from "@/components/interactive-chart";
import { PageHeader } from "@/components/page-header";
import { EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { ReportFilters } from "@/components/report-filters";
import { db } from "@/db";
import { cashFlowEntries, investments, investmentValuations } from "@/db/schema";
import { formatDate, formatReportMoney, toCents } from "@/lib/accounting";
import { INVESTMENT_KIND_LABELS } from "@/lib/investment-types";
import { monthEnds, positionAt, type InvestmentMovement, type InvestmentValuation } from "@/lib/investment-series";
import { addDaysIso, readPeriod } from "@/lib/period";
import { MONTH_SHORT } from "@/lib/plan/calc";
import { cn } from "@/lib/utils";

const signed = (cents: number) => (cents < 0 ? `-${formatReportMoney(-cents)}` : formatReportMoney(cents));
const pct = (v: number | null) => (v === null ? "-" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const monthLabel = (iso: string) => `${MONTH_SHORT[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;

/** Relatório das aplicações: posição no fim do período, movimentações e gráficos. */
export async function InvestmentsReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);
  const list = await db.select().from(investments).where(eq(investments.companyId, company.id)).orderBy(asc(investments.name));
  const ids = list.map((i) => i.id);
  const [valuationRows, movementRows] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          db.select().from(investmentValuations).where(inArray(investmentValuations.investmentId, ids)),
          db
            .select({
              investmentId: cashFlowEntries.investmentId,
              date: cashFlowEntries.date,
              type: cashFlowEntries.type,
              amount: cashFlowEntries.amount,
              description: cashFlowEntries.description,
            })
            .from(cashFlowEntries)
            .where(and(eq(cashFlowEntries.companyId, company.id), isNotNull(cashFlowEntries.investmentId), inArray(cashFlowEntries.type, ["economia", "entrada"])))
            .orderBy(asc(cashFlowEntries.date)),
        ]);

  const data = list.map((inv) => {
    const movements: InvestmentMovement[] = movementRows
      .filter((m) => m.investmentId === inv.id)
      .map((m) => ({ date: m.date, kind: m.type === "economia" ? "aporte" : "resgate", cents: toCents(m.amount), description: m.description }));
    const valuations: InvestmentValuation[] = valuationRows.filter((v) => v.investmentId === inv.id).map((v) => ({ date: v.date, cents: toCents(v.balance) }));
    const end = positionAt(period.to, movements, valuations);
    const start = positionAt(addDaysIso(period.from, -1), movements, valuations);
    const inPeriod = movements.filter((m) => m.date >= period.from && m.date <= period.to);
    return {
      inv,
      movements,
      valuations,
      end,
      inPeriod,
      contributions: inPeriod.filter((m) => m.kind === "aporte").reduce((s, m) => s + m.cents, 0),
      withdrawals: inPeriod.filter((m) => m.kind === "resgate").reduce((s, m) => s + m.cents, 0),
      gainInPeriod: end.gain - start.gain,
    };
  });
  const shown = data.filter((d) => d.inv.active || d.end.balance !== 0 || d.inPeriod.length > 0);
  const total = shown.reduce(
    (t, d) => ({
      balance: t.balance + d.end.balance,
      capital: t.capital + d.end.capital,
      gain: t.gain + d.end.gain,
      contributions: t.contributions + d.contributions,
      withdrawals: t.withdrawals + d.withdrawals,
      gainInPeriod: t.gainInPeriod + d.gainInPeriod,
    }),
    { balance: 0, capital: 0, gain: 0, contributions: 0, withdrawals: 0, gainInPeriod: 0 },
  );

  // Evolução da carteira no fim de cada mês do período.
  const ends = monthEnds(period.from, period.to);
  const evolution = ends.map((date) =>
    shown.reduce(
      (t, d) => {
        const p = positionAt(date, d.movements, d.valuations);
        return { capital: t.capital + p.capital, balance: t.balance + p.balance, gain: t.gain + p.gain };
      },
      { capital: 0, balance: 0, gain: 0 },
    ),
  );
  const movementsInPeriod = shown
    .flatMap((d) => [
      ...d.inPeriod.map((m) => ({ date: m.date, name: d.inv.name, kind: m.kind === "aporte" ? "Aporte" : "Resgate", description: m.description, cents: m.cents })),
      ...d.valuations
        .filter((v) => v.date >= period.from && v.date <= period.to)
        .map((v) => ({ date: v.date, name: d.inv.name, kind: "Saldo informado", description: "Saldo do extrato", cents: v.cents })),
    ])
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return (
    <>
      <PageHeader title="Relatório de aplicações financeiras" />
      <ReportFilters period={period} />
      <ReportSheet company={company} title="Aplicações Financeiras" period={period}>
        {shown.length === 0 ? (
          <EmptyReport>Nenhuma aplicação cadastrada.</EmptyReport>
        ) : (
          <div className="grid gap-8">
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
              {[
                { label: "Total aplicado", value: formatReportMoney(total.capital) },
                { label: "Saldo líquido", value: formatReportMoney(total.balance) },
                { label: "Total de rendimentos", value: signed(total.gain), tone: total.gain < 0 ? "text-destructive" : undefined },
                { label: "Rendimentos no período", value: signed(total.gainInPeriod), tone: total.gainInPeriod < 0 ? "text-destructive" : undefined },
              ].map((c) => (
                <div key={c.label} className="rounded-md border p-2.5">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className={cn("font-semibold tabular-nums", c.tone)}>{c.value}</div>
                </div>
              ))}
            </section>

            <section>
              <h3 className="mb-2 font-semibold uppercase">Posição em {formatDate(period.to)}</h3>
              <ReportTable>
                <thead>
                  <tr>
                    <Th>Aplicação</Th>
                    <Th>Tipo</Th>
                    <Th className={num}>Capital aplicado</Th>
                    <Th className={num}>Saldo líquido</Th>
                    <Th className={num}>Ganho de capital</Th>
                    <Th className={num}>Rentab.</Th>
                    <Th className={num}>% carteira</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((d) => (
                    <tr key={d.inv.id} className="border-b border-border/60">
                      <td>
                        {d.inv.name}
                        {d.inv.institution && <span className="text-muted-foreground"> · {d.inv.institution}</span>}
                      </td>
                      <td>{INVESTMENT_KIND_LABELS[d.inv.kind]}</td>
                      <td className={num}>{formatReportMoney(d.end.capital)}</td>
                      <td className={num}>{formatReportMoney(d.end.balance)}</td>
                      <td className={cn(num, d.end.gain < 0 && "text-destructive")}>{signed(d.end.gain)}</td>
                      <td className={num}>{pct(d.end.capital > 0 ? d.end.gain / d.end.capital : null)}</td>
                      <td className={num}>{pct(total.balance ? d.end.balance / total.balance : null)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/70 font-bold">
                    <td colSpan={2}>Total</td>
                    <td className={num}>{formatReportMoney(total.capital)}</td>
                    <td className={num}>{formatReportMoney(total.balance)}</td>
                    <td className={cn(num, total.gain < 0 && "text-destructive")}>{signed(total.gain)}</td>
                    <td className={num}>{pct(total.capital > 0 ? total.gain / total.capital : null)}</td>
                    <td className={num}>{total.balance ? "100%" : "-"}</td>
                  </tr>
                </tfoot>
              </ReportTable>
            </section>

            <section className="grid gap-6 break-inside-avoid md:grid-cols-2 print:grid-cols-2">
              <InteractiveChart
                title="Composição da carteira"
                type="rosca"
                height={240}
                data={{
                  labels: shown.map((d) => d.inv.name),
                  money: true,
                  series: [{ name: "Saldo", color: "#2563eb", values: shown.map((d) => d.end.balance) }],
                }}
              />
              <InteractiveChart
                title="Capital aplicado e ganho por aplicação"
                type="barras-empilhadas"
                height={240}
                data={{
                  labels: shown.map((d) => d.inv.name),
                  money: true,
                  series: [
                    { name: "Capital aplicado", color: "#64748b", values: shown.map((d) => d.end.capital) },
                    { name: "Ganho de capital", color: "#16a34a", values: shown.map((d) => d.end.gain) },
                  ],
                }}
              />
            </section>

            <section className="grid gap-6 break-inside-avoid md:grid-cols-2 print:grid-cols-2">
              <InteractiveChart
                title="Aportes x saldo líquido"
                type="linhas"
                height={240}
                data={{
                  labels: ends.map(monthLabel),
                  money: true,
                  series: [
                    { name: "Aportes acumulados", color: "#94a3b8", values: evolution.map((e) => e.capital) },
                    { name: "Saldo líquido", color: "#2563eb", values: evolution.map((e) => e.balance) },
                  ],
                }}
              />
              <InteractiveChart
                title="Capital aplicado e ganho de capital"
                type="barras-empilhadas"
                height={240}
                data={{
                  labels: ends.map(monthLabel),
                  money: true,
                  series: [
                    { name: "Capital aplicado", color: "#64748b", values: evolution.map((e) => e.capital) },
                    { name: "Ganho de capital", color: "#16a34a", values: evolution.map((e) => e.gain) },
                  ],
                }}
              />
            </section>

            <section className="break-inside-avoid">
              <h3 className="mb-2 font-semibold uppercase">Movimentações no período</h3>
              <ReportTable>
                <thead>
                  <tr>
                    <Th className={num}>Aportes</Th>
                    <Th className={num}>Resgates</Th>
                    <Th className={num}>Rendimentos</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-semibold">
                    <td className={num}>{formatReportMoney(total.contributions)}</td>
                    <td className={num}>{formatReportMoney(total.withdrawals)}</td>
                    <td className={cn(num, total.gainInPeriod < 0 && "text-destructive")}>{signed(total.gainInPeriod)}</td>
                  </tr>
                </tbody>
              </ReportTable>
              {movementsInPeriod.length > 0 && (
                <ReportTable className="mt-3">
                  <thead>
                    <tr>
                      <Th className="w-24">Data</Th>
                      <Th>Aplicação</Th>
                      <Th>Tipo</Th>
                      <Th>Descrição</Th>
                      <Th className={num}>Valor</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsInPeriod.map((m, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td>{formatDate(m.date)}</td>
                        <td>{m.name}</td>
                        <td>{m.kind}</td>
                        <td className="text-muted-foreground">{m.description}</td>
                        <td className={num}>{formatReportMoney(m.cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </ReportTable>
              )}
            </section>
          </div>
        )}
      </ReportSheet>
    </>
  );
}
