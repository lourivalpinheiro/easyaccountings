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
import { investmentSeries, openingCapital, type InvestmentMovement, type InvestmentValuation } from "@/lib/investment-series";
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
  const opening = useMemo(() => openingCapital(movements, valuations), [movements, valuations]);
  const last = series[series.length - 1];
  const balance = last?.balance ?? 0;
  const capital = last?.capital ?? 0;
  const gain = last?.gain ?? 0;
  const profitability = capital > 0 ? gain / capital : null;

  const history = [
    ...movements.map((m) => ({ date: m.date, kind: m.kind === "aporte" ? "Aporte" : "Resgate", description: m.description, cents: m.kind === "aporte" ? m.cents : -m.cents })),
    ...valuations.map((v) => ({
      date: v.date,
      kind: "Saldo informado",
      description: v.date === opening.date ? "Saldo inicial (capital já aplicado)" : "Saldo do extrato (inclui rendimentos)",
      cents: v.cents,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const cards = [
    { label: "Saldo líquido", value: formatMoney(balance) },
    { label: "Capital aplicado", value: signedMoney(capital), hint: opening.date ? "saldo inicial + aportes - resgates" : "aportes - resgates" },
    { label: "Ganho de capital", value: signedMoney(gain), tone: gain < 0 ? "text-destructive" : gain > 0 ? "text-emerald-600 dark:text-emerald-400" : undefined },
    {
      label: "Rentabilidade",
      value: profitability === null ? "—" : `${(profitability * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`,
      hint: "ganho ÷ capital aplicado",
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
              title="Aportes x saldo líquido"
              type="linhas"
              height={260}
              data={{
                labels: series.map((p) => label(p.month)),
                money: true,
                series: [
                  { name: "Aportes acumulados", color: "#94a3b8", values: series.map((p) => p.capital) },
                  { name: "Saldo líquido", color: "#2563eb", values: series.map((p) => p.balance) },
                ],
              }}
            />
            <InteractiveChart
              title="Capital aplicado e ganho de capital"
              type="barras-empilhadas"
              height={260}
              data={{
                labels: series.map((p) => label(p.month)),
                money: true,
                series: [
                  { name: "Capital aplicado", color: "#64748b", values: series.map((p) => p.capital) },
                  { name: "Ganho de capital", color: "#16a34a", values: series.map((p) => p.gain) },
                ],
              }}
            />
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
