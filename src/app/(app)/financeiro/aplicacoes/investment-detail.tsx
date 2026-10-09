"use client";

import { LineChart } from "lucide-react";
import { useMemo } from "react";
import { InteractiveChart } from "@/components/interactive-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/accounting";
import { INVESTMENT_KIND_LABELS, type InvestmentKind } from "@/lib/investment-types";
import { investmentSeries, type InvestmentMovement, type InvestmentValuation } from "@/lib/investment-series";
import { MONTH_SHORT } from "@/lib/plan/calc";
import { cn } from "@/lib/utils";

const label = (ym: string) => `${MONTH_SHORT[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
const signedMoney = (c: number) => `${c < 0 ? "-" : ""}${formatMoney(Math.abs(c))}`;

/** Evolução de uma aplicação: saldo, aportes, rendimentos e histórico. */
export function InvestmentDetail({
  investment,
  movements,
  valuations,
  today,
  onClose,
  onUpdateBalance,
}: {
  investment: { id: string; name: string; kind: InvestmentKind; institution: string | null };
  movements: InvestmentMovement[];
  valuations: InvestmentValuation[];
  today: string;
  onClose: () => void;
  onUpdateBalance: () => void;
}) {
  const series = useMemo(() => investmentSeries(movements, valuations, today), [movements, valuations, today]);
  const last = series[series.length - 1];
  const balance = last?.balance ?? 0;
  const invested = last?.invested ?? 0;
  const yieldTotal = last?.yieldTotal ?? 0;
  const last12 = series.slice(-12).reduce((s, p) => s + p.yieldMonth, 0);
  const profitability = invested > 0 ? yieldTotal / invested : null;

  const history = [
    ...movements.map((m) => ({ date: m.date, kind: m.kind === "aporte" ? "Aporte" : "Resgate", description: m.description, cents: m.kind === "aporte" ? m.cents : -m.cents })),
    ...valuations.map((v) => ({ date: v.date, kind: "Saldo informado", description: "Saldo do extrato (inclui rendimentos)", cents: v.cents })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const cards = [
    { label: "Saldo atual", value: formatMoney(balance) },
    { label: "Aportes líquidos", value: signedMoney(invested), hint: "aportes - resgates" },
    { label: "Rendimento acumulado", value: signedMoney(yieldTotal), tone: yieldTotal < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400" },
    {
      label: "Rentabilidade",
      value: profitability === null ? "—" : `${(profitability * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
      hint: `${signedMoney(last12)} nos últimos 12 meses`,
    },
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {investment.name}
            <Badge variant="outline">{INVESTMENT_KIND_LABELS[investment.kind]}</Badge>
          </DialogTitle>
          <DialogDescription>{investment.institution ?? "Evolução do saldo, aportes e rendimentos."}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-md border bg-muted/30 p-2.5">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className={cn("font-semibold tabular-nums", c.tone)}>{c.value}</div>
              {c.hint && <div className="text-xs text-muted-foreground">{c.hint}</div>}
            </div>
          ))}
        </div>

        {valuations.length === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Nenhum saldo informado: sem ele não há como saber os rendimentos. Informe o saldo do extrato da aplicação.
            <Button size="sm" variant="outline" onClick={onUpdateBalance}>
              <LineChart /> Informar saldo
            </Button>
          </div>
        )}

        {series.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sem aportes, resgates ou saldos informados ainda. Lance um aporte no fluxo de caixa (tipo Economia) ligado a esta aplicação.
          </p>
        ) : (
          <div className="grid gap-4">
            <InteractiveChart
              title="Evolução do saldo"
              type="area"
              height={260}
              data={{
                labels: series.map((p) => label(p.month)),
                money: true,
                series: [
                  { name: "Saldo", color: "#2563eb", values: series.map((p) => p.balance) },
                  { name: "Aportes líquidos", color: "#94a3b8", values: series.map((p) => p.invested) },
                ],
              }}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <InteractiveChart
                title="Rendimento no mês"
                type="barras"
                height={220}
                data={{
                  labels: series.map((p) => label(p.month)),
                  money: true,
                  series: [{ name: "Rendimento", color: "#16a34a", values: series.map((p) => p.yieldMonth) }],
                }}
              />
              <InteractiveChart
                title="Rendimento acumulado"
                type="linhas"
                height={220}
                data={{
                  labels: series.map((p) => label(p.month)),
                  money: true,
                  series: [{ name: "Rendimento acumulado", color: "#9333ea", values: series.map((p) => p.yieldTotal) }],
                }}
              />
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="grid gap-2">
            <div className="text-sm font-semibold">Histórico</div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead className="w-36">Tipo</TableHead>
                    <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="tabular-nums">{formatDate(h.date)}</TableCell>
                      <TableCell>
                        <Badge variant={h.kind === "Saldo informado" ? "secondary" : "outline"}>{h.kind}</Badge>
                      </TableCell>
                      <TableCell className="hidden max-w-64 truncate sm:table-cell">{h.description}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          h.kind === "Aporte" && "text-emerald-600 dark:text-emerald-400",
                          h.kind === "Resgate" && "text-destructive",
                        )}
                      >
                        {h.kind === "Saldo informado" ? formatMoney(h.cents) : signedMoney(h.cents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
