import type { Company } from "@/lib/company";
import type { SearchParams } from "@/reports/types";
import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { EmptyReport, num, ReportSheet, ReportTable, Th } from "@/components/report";
import { ReportFilters } from "@/components/report-filters";
import { db } from "@/db";
import { explanatoryNotes } from "@/db/schema";
import { formatReportBalance, formatReportMoney } from "@/lib/accounting";
import { getChart, getMovements, rollup } from "@/lib/data/ledger";
import { readPeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

const BALANCE_GROUPS = new Set(["ativo", "passivo", "patrimonio_liquido"]);

export async function BalanceSheetReport({ company, params }: { company: Company; params: SearchParams }) {
  const period = readPeriod(params);
  const showZero = params.zeradas === "1";

  const [chart, inPeriod, untilEnd, notes] = await Promise.all([
    getChart(company.id),
    getMovements(company.id, { from: period.from, to: period.to }),
    getMovements(company.id, { to: period.to }),
    db
      .select()
      .from(explanatoryNotes)
      .where(eq(explanatoryNotes.companyId, company.id))
      .orderBy(asc(explanatoryNotes.number)),
  ]);

  const accounts = chart.filter((a) => a.group && BALANCE_GROUPS.has(a.group));
  const period_ = rollup(accounts, inPeriod);
  const balance = rollup(accounts, untilEnd);
  const rows = accounts
    .map((a) => {
      const m = period_.get(a.id)!;
      const b = balance.get(a.id)!;
      return { ...a, debit: m.debit, credit: m.credit, balance: b.debit - b.credit };
    })
    .filter((r) => showZero || r.debit !== 0 || r.credit !== 0 || r.balance !== 0);

  const notesByAccount = new Map<string, typeof notes>();
  for (const n of notes) {
    if (!n.accountId) continue;
    notesByAccount.set(n.accountId, [...(notesByAccount.get(n.accountId) ?? []), n]);
  }
  const shownNotes = notes.filter((n) => !n.accountId || rows.some((r) => r.id === n.accountId));

  // Ativo x (Passivo + PL): a diferença é o resultado ainda não zerado.
  const unclosed = accounts
    .filter((a) => a.analytic)
    .reduce((s, a) => {
      const b = balance.get(a.id)!;
      return s + b.debit - b.credit;
    }, 0);

  return (
    <>
      <PageHeader title="Balanço Patrimonial" />
      <ReportFilters period={period} showZeroOption />
      <ReportSheet company={company} title="Balanço Patrimonial" period={period}>
        {rows.length === 0 ? (
          <EmptyReport />
        ) : (
          <ReportTable>
            <thead>
              <tr>
                <Th className="w-28">Classificação</Th>
                <Th>Descrição</Th>
                <Th className={num}>Débito</Th>
                <Th className={num}>Crédito</Th>
                <Th className={num}>Saldo atual</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-b border-border/60", !r.analytic && "font-semibold", r.level === 1 && "bg-muted/50")}>
                  <td className="tabular-nums">{r.classification}</td>
                  <td style={{ paddingLeft: `${(r.level - 1) * 1 + 0.5}rem` }}>
                    {r.name}
                    {notesByAccount.get(r.id)?.map((n) => (
                      <a key={n.id} href={`#nota-${n.number}`} className="ml-2 text-xs font-normal text-primary">
                        (Nota {n.number})
                      </a>
                    ))}
                  </td>
                  <td className={num}>{formatReportMoney(r.debit)}</td>
                  <td className={num}>{formatReportMoney(r.credit)}</td>
                  <td className={num}>{formatReportBalance(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </ReportTable>
        )}
        {unclosed !== 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Diferença entre Ativo e Passivo + Patrimônio Líquido de {formatReportBalance(unclosed)}, correspondente ao resultado
            ainda não zerado.
          </p>
        )}
        {shownNotes.length > 0 && (
          <section className="mt-8 break-before-page">
            <h3 className="mb-3 text-center font-bold uppercase">Notas explicativas</h3>
            <div className="grid gap-6">
              {shownNotes.map((n) => (
                <div key={n.id} id={`nota-${n.number}`}>
                  <h4 className="font-semibold">
                    Nota {n.number} - {n.title}
                  </h4>
                  <div className="tiptap-content text-sm" dangerouslySetInnerHTML={{ __html: n.content }} />
                </div>
              ))}
            </div>
          </section>
        )}
      </ReportSheet>
    </>
  );
}
