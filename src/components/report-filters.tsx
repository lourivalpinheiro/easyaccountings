"use client";

import { Printer, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PeriodPresets } from "@/components/period-presets";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Filtros de período (e opções extras) que gravam na URL do relatório. */
export function ReportFilters({
  period,
  showZeroOption,
  children,
  extraParams,
}: {
  period: { from: string; to: string };
  showZeroOption?: boolean;
  children?: React.ReactNode;
  extraParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [zero, setZero] = useState(params.get("zeradas") === "1");

  const apply = (override?: { from: string; to: string }) => {
    const q = new URLSearchParams(params);
    q.set("de", override?.from ?? from);
    q.set("ate", override?.to ?? to);
    if (showZeroOption) {
      if (zero) q.set("zeradas", "1");
      else q.delete("zeradas");
    }
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.push(`${pathname}?${q.toString()}`);
  };

  return (
    <div className="no-print mb-4 grid grid-cols-2 items-end gap-3 rounded-lg border bg-card p-3 sm:flex sm:flex-wrap">
      <PeriodPresets
        className="col-span-2 sm:basis-full"
        value={period}
        onSelect={(p) => {
          setFrom(p.from);
          setTo(p.to);
          apply(p);
        }}
      />
      <div className="grid gap-1.5">
        <Label htmlFor="f-from">De</Label>
        <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-40" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-to">Até</Label>
        <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-40" />
      </div>
      {children && <div className="col-span-2 sm:col-span-1">{children}</div>}
      {showZeroOption && (
        <Label className="col-span-2 mb-2 flex items-center gap-2 font-normal">
          <Checkbox checked={zero} onCheckedChange={(v) => setZero(v === true)} />
          Exibir contas sem saldo
        </Label>
      )}
      <Button onClick={() => apply()}>
        <Search /> Emitir
      </Button>
      <Button variant="outline" onClick={() => window.print()} className="sm:ml-auto">
        <Printer /> Imprimir / PDF
      </Button>
    </div>
  );
}
