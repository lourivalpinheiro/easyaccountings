import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { ReportChart } from "@/components/report-chart";
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

export type InvestmentsReportData = {
  period: { from: string; to: string };
  rows: { id: string; name: string; institution: string | null; kindLabel: string; balance: number; capital: number; gain: number }[];
  total: { balance: number; capital: number; gain: number; contributions: number; withdrawals: number; gainInPeriod: number };
  evolution: { date: string; capital: number; balance: number; gain: number }[];
  movements: { date: string; name: string; kind: string; description: string; cents: number }[];
};

/** Relatório das aplicações: posição no fim do período, gráficos e movimentações. */
export async function InvestmentsReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);
  return (
    <>
      <PageHeader title="Relatório de aplicações financeiras" />
      <ReportFilters period={period} />
      <ReportSheet company={company} title="Aplicações Financeiras" period={period}>
        <InvestmentsReportBody {...await getInvestmentsReportData(company.id, period)} />
      </ReportSheet>
    </>
  );
}

async function getInvestmentsReportData(companyId: string, period: { from: string; to: string }): Promise<InvestmentsReportData> {
  const list = await db.select().from(investments).where(eq(investments.companyId, companyId)).orderBy(asc(investments.name));
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
            .where(and(eq(cashFlowEntries.companyId, companyId), isNotNull(cashFlowEntries.investmentId), inArray(cashFlowEntries.type, ["economia", "entrada"])))
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
  const evolution = monthEnds(period.from, period.to).map((date) =>
    shown.reduce(
      (t, d) => {
        const p = positionAt(date, d.movements, d.valuations);
        return { date, capital: t.capital + p.capital, balance: t.balance + p.balance, gain: t.gain + p.gain };
      },
      { date, capital: 0, balance: 0, gain: 0 },
    ),
  );
  const movements = shown
    .flatMap((d) => [
      ...d.inPeriod.map((m) => ({ date: m.date, name: d.inv.name, kind: m.kind === "aporte" ? "Aporte" : "Resgate", description: m.description, cents: m.cents })),
      ...d.valuations
        .filter((v) => v.date >= period.from && v.date <= period.to)
        .map((v) => ({ date: v.date, name: d.inv.name, kind: "Saldo informado", description: "Saldo do extrato", cents: v.cents })),
    ])
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    period,
    rows: shown.map((d) => ({ id: d.inv.id, name: d.inv.name, institution: d.inv.institution, kindLabel: INVESTMENT_KIND_LABELS[d.inv.kind], ...d.end })),
    total,
    evolution,
    movements,
  };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-md border p-2.5">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className={cn("truncate font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}

/** Conteúdo do relatório (sem consultas), separado para poder ser visualizado com quaisquer dados. */
export function InvestmentsReportBody({ period, rows, total, evolution, movements }: InvestmentsReportData) {
  if (rows.length === 0) return <EmptyReport>Nenhuma aplicação cadastrada.</EmptyReport>;
  const labels = evolution.map((e) => monthLabel(e.date));
  const red = (v: number) => (v < 0 ? "text-destructive" : undefined);
  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4 print:grid-cols-4">
        <Stat label="Total aplicado" value={formatReportMoney(total.capital)} />
        <Stat label="Saldo líquido" value={formatReportMoney(total.balance)} />
        <Stat label="Total de rendimentos" value={signed(total.gain)} tone={red(total.gain)} />
        <Stat label="Rendimentos no período" value={signed(total.gainInPeriod)} tone={red(total.gainInPeriod)} />
      </section>

      <section className="min-w-0">
        <h3 className="mb-2 font-semibold uppercase">Posição em {formatDate(period.to)}</h3>
        <div className="overflow-x-auto">
          <ReportTable>
            <thead>
              <tr>
                <Th>Aplicação</Th>
                <Th className="hidden sm:table-cell print:table-cell">Tipo</Th>
                <Th className={num}>Capital aplicado</Th>
                <Th className={num}>Saldo líquido</Th>
                <Th className={num}>Ganho</Th>
                <Th className={num}>Rentab.</Th>
                <Th className={cn(num, "hidden md:table-cell print:table-cell")}>% carteira</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-b border-border/60">
                  <td>
                    {d.name}
                    {d.institution && <div className="text-xs text-muted-foreground">{d.institution}</div>}
                  </td>
                  <td className="hidden sm:table-cell print:table-cell">{d.kindLabel}</td>
                  <td className={num}>{formatReportMoney(d.capital)}</td>
                  <td className={num}>{formatReportMoney(d.balance)}</td>
                  <td className={cn(num, red(d.gain))}>{signed(d.gain)}</td>
                  <td className={num}>{pct(d.capital > 0 ? d.gain / d.capital : null)}</td>
                  <td className={cn(num, "hidden md:table-cell print:table-cell")}>{pct(total.balance ? d.balance / total.balance : null)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/70 font-bold">
                <td>Total</td>
                <td className="hidden sm:table-cell print:table-cell" />
                <td className={num}>{formatReportMoney(total.capital)}</td>
                <td className={num}>{formatReportMoney(total.balance)}</td>
                <td className={cn(num, red(total.gain))}>{signed(total.gain)}</td>
                <td className={num}>{pct(total.capital > 0 ? total.gain / total.capital : null)}</td>
                <td className={cn(num, "hidden md:table-cell print:table-cell")}>{total.balance ? "100%" : "-"}</td>
              </tr>
            </tfoot>
          </ReportTable>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 print:grid-cols-1">
        <ReportChart
          title="Composição da carteira"
          type="rosca"
          data={{ labels: rows.map((d) => d.name), money: true, series: [{ name: "Saldo", color: "#2563eb", values: rows.map((d) => d.balance) }] }}
        />
        <ReportChart
          title="Capital aplicado e ganho por aplicação"
          type="barras-empilhadas"
          data={{
            labels: rows.map((d) => d.name),
            money: true,
            series: [
              { name: "Capital aplicado", color: "#64748b", values: rows.map((d) => d.capital) },
              { name: "Ganho de capital", color: "#16a34a", values: rows.map((d) => d.gain) },
            ],
          }}
        />
        <ReportChart
          title="Aportes x saldo líquido"
          type="linhas"
          data={{
            labels,
            money: true,
            series: [
              { name: "Aportes acumulados", color: "#94a3b8", values: evolution.map((e) => e.capital) },
              { name: "Saldo líquido", color: "#2563eb", values: evolution.map((e) => e.balance) },
            ],
          }}
        />
        <ReportChart
          title="Capital aplicado e ganho de capital no período"
          type="barras-empilhadas"
          data={{
            labels,
            money: true,
            series: [
              { name: "Capital aplicado", color: "#64748b", values: evolution.map((e) => e.capital) },
              { name: "Ganho de capital", color: "#16a34a", values: evolution.map((e) => e.gain) },
            ],
          }}
        />
      </section>

      <section className="min-w-0 break-inside-avoid">
        <h3 className="mb-2 font-semibold uppercase">Movimentações no período</h3>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Stat label="Aportes" value={formatReportMoney(total.contributions)} />
          <Stat label="Resgates" value={formatReportMoney(total.withdrawals)} />
          <Stat label="Rendimentos" value={signed(total.gainInPeriod)} tone={red(total.gainInPeriod)} />
        </div>
        {movements.length > 0 ? (
          <div className="overflow-x-auto">
            <ReportTable>
              <thead>
                <tr>
                  <Th className="w-24">Data</Th>
                  <Th>Aplicação</Th>
                  <Th>Tipo</Th>
                  <Th className="hidden md:table-cell print:table-cell">Descrição</Th>
                  <Th className={num}>Valor</Th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td>{formatDate(m.date)}</td>
                    <td>{m.name}</td>
                    <td>{m.kind}</td>
                    <td className="hidden text-muted-foreground md:table-cell print:table-cell">{m.description}</td>
                    <td className={num}>{formatReportMoney(m.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação no período.</p>
        )}
      </section>
    </div>
  );
}
