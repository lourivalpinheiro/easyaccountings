"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CashCalendarHeatmap } from "@/components/cash-calendar-heatmap";
import { BANDS } from "@/components/cash-thermometer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatMoney } from "@/lib/accounting";
import type { CalendarMonth } from "@/lib/data/cash-flow";
import { cn } from "@/lib/utils";

export function HealthClient({
  totalMonths,
  currentBalance,
  worst,
  months,
}: {
  totalMonths: number;
  currentBalance: number;
  worst: { date: string; balance: number } | null;
  months: CalendarMonth[];
}) {
  const router = useRouter();
  const [meses, setMeses] = useState(String(totalMonths));

  const apply = () => {
    const n = Math.min(24, Math.max(1, Math.floor(Number(meses)) || 3));
    router.push(`?meses=${n}`);
  };

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-1 py-3 sm:py-4">
          <CardHeader className="px-3 sm:px-4">
            <CardDescription>Saldo atual</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4">
            <div className={cn("text-base font-semibold tabular-nums sm:text-xl", currentBalance < 0 && "text-destructive")}>
              {currentBalance < 0 ? "-" : ""}
              {formatMoney(Math.abs(currentBalance))}
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:py-4">
          <CardHeader className="px-3 sm:px-4">
            <CardDescription>{worst ? `Pior saldo real (${formatDate(worst.date)})` : "Pior saldo real"}</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4">
            <div className={cn("text-base font-semibold tabular-nums sm:text-xl", worst && worst.balance < 0 && "text-destructive")}>
              {worst ? `${worst.balance < 0 ? "-" : ""}${formatMoney(Math.abs(worst.balance))}` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <CardTitle>Calendário de saldo</CardTitle>
            <CardDescription>Real até hoje; previsto (mais claro) nos dias seguintes, com base nas movimentações agendadas e recorrentes.</CardDescription>
          </div>
          <div className="flex items-end gap-2">
            <div className="grid gap-2">
              <Label htmlFor="meses-frente">Total de meses</Label>
              <Input
                id="meses-frente"
                type="number"
                min={1}
                max={24}
                className="w-24"
                value={meses}
                onChange={(e) => setMeses(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apply()}
              />
            </div>
            <Button variant="outline" onClick={apply}>
              <Search /> Aplicar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {[...BANDS].reverse().map((b) => (
              <span key={b.id} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", b.bar)} />
                {b.label}
              </span>
            ))}
          </div>
          <CashCalendarHeatmap months={months} />
        </CardContent>
      </Card>
    </div>
  );
}
