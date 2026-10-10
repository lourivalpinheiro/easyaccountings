import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { and, asc, eq, gte, lt, lte } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { ReportFilters } from "@/components/report-filters";
import { db } from "@/db";
import { provisions } from "@/db/schema";
import { formatDate, formatReportMoney, toCents } from "@/lib/accounting";
import { readPeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

/** Saldo com sinal: negativo em vermelho, igual ao saldo do fluxo de caixa. */
const balance = (cents: number) => (cents === 0 ? "-" : cents < 0 ? `-${formatReportMoney(-cents)}` : formatReportMoney(cents));

export async function ProvisionamentoReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);

  const [before, rows] = await Promise.all([
    db
      .select({ type: provisions.type, amount: provisions.amount })
      .from(provisions)
      .where(and(eq(provisions.companyId, company.id), lt(provisions.dueDate, period.from))),
    db
      .select()
      .from(provisions)
      .where(and(eq(provisions.companyId, company.id), gte(provisions.dueDate, period.from), lte(provisions.dueDate, period.to)))
      .orderBy(asc(provisions.dueDate), asc(provisions.createdAt)),
  ]);

  const previous = before.reduce((s, r) => s + (r.type === "receber" ? toCents(r.amount) : -toCents(r.amount)), 0);

  let running = previous;
  const lines = [];
  for (const r of rows) {
    const cents = toCents(r.amount);
    running += r.type === "receber" ? cents : -cents;
    lines.push({ ...r, cents, balance: running });
  }
  const totalReceber = lines.filter((l) => l.type === "receber").reduce((s, l) => s + l.cents, 0);
  const totalPagar = lines.filter((l) => l.type === "pagar").reduce((s, l) => s + l.cents, 0);

  return (
    <>
      <PageHeader title="Relatório de provisionamento" />
      <ReportFilters period={period} />
      <ReportSheet company={company} title="Contas a Pagar e a Receber" period={period}>
        {lines.length === 0 ? (
          <EmptyReport>Nenhuma conta com vencimento no período. Saldo: {balance(previous)}.</EmptyReport>
        ) : (
          <ReportTable>
            <thead>
              <tr>
                <Th className="w-24">Data</Th>
                <Th>Descrição</Th>
                <Th>Categoria</Th>
                <Th className={num}>A Receber</Th>
                <Th className={num}>A Pagar</Th>
                <Th className={num}>Saldo</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-semibold">
                <td colSpan={5}>Saldo anterior</td>
                <td className={num}>{balance(previous)}</td>
              </tr>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-border/40">
                  <td className="tabular-nums">{formatDate(l.dueDate)}</td>
                  <td>
                    {l.description}
                    {l.settledAt && <span className="ml-1.5 text-xs text-muted-foreground">(baixado {formatDate(l.settledAt)})</span>}
                  </td>
                  <td className="text-muted-foreground">{l.category ?? ""}</td>
                  <td className={num}>{l.type === "receber" ? formatReportMoney(l.cents) : ""}</td>
                  <td className={num}>{l.type === "pagar" ? formatReportMoney(l.cents) : ""}</td>
                  <td className={cn(num, l.balance < 0 && "text-destructive")}>{balance(l.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/70 font-bold">
                <td colSpan={3} className="text-right">
                  Totais do período / Saldo final
                </td>
                <td className={num}>{formatReportMoney(totalReceber)}</td>
                <td className={num}>{formatReportMoney(totalPagar)}</td>
                <td className={cn(num, running < 0 && "text-destructive")}>{balance(running)}</td>
              </tr>
            </tfoot>
          </ReportTable>
        )}
      </ReportSheet>
    </>
  );
}
