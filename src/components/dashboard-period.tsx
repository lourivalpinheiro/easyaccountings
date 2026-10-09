"use client";

import { CalendarRange } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PeriodPresets } from "@/components/period-presets";
import { cn } from "@/lib/utils";

/** Período das informações do painel (padrão: mês atual completo). */
export function DashboardPeriod({ period }: { period: { from: string; to: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const go = (p: { from: string; to: string }) => router.push(`${pathname}?de=${p.from}&ate=${p.to}`);

  return (
    <div className="no-print flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <PeriodPresets
        value={period}
        onSelect={(p) => {
          setFrom(p.from);
          setTo(p.to);
          go(p);
        }}
      />
      <div className="grid gap-1">
        <Label htmlFor="dash-from" className="text-xs">
          De
        </Label>
        <Input id="dash-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="dash-to" className="text-xs">
          Até
        </Label>
        <Input id="dash-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-40" />
      </div>
      <Button size="sm" variant="outline" className={cn(from > to && "pointer-events-none opacity-50")} onClick={() => go({ from, to })}>
        <CalendarRange /> Aplicar
      </Button>
    </div>
  );
}
