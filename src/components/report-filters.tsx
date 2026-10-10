"use client";

import { Printer } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PeriodPicker } from "@/components/period-presets";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** Filtros de período (e opções extras) que gravam na URL do relatório. */
export function ReportFilters({
  period,
  showZeroOption,
  showSummaryOption,
  children,
  extraParams,
}: {
  period: { from: string; to: string };
  showZeroOption?: boolean;
  showSummaryOption?: boolean;
  children?: React.ReactNode;
  extraParams?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [zero, setZero] = useState(params.get("zeradas") === "1");
  const [summary, setSummary] = useState(params.get("resumo") === "1");

  const apply = (override?: { from: string; to: string }) => {
    const q = new URLSearchParams(params);
    q.set("de", override?.from ?? period.from);
    q.set("ate", override?.to ?? period.to);
    if (showZeroOption) {
      if (zero) q.set("zeradas", "1");
      else q.delete("zeradas");
    }
    if (showSummaryOption) {
      if (summary) q.set("resumo", "1");
      else q.delete("resumo");
    }
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.push(`${pathname}?${q.toString()}`);
  };

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      <PeriodPicker value={period} onChange={(p) => apply(p)} />
      {children}
      {showZeroOption && (
        <Label className="flex items-center gap-2 text-xs font-normal">
          <Checkbox
            checked={zero}
            onCheckedChange={(v) => {
              setZero(v === true);
              const q = new URLSearchParams(params);
              if (v === true) q.set("zeradas", "1");
              else q.delete("zeradas");
              router.push(`${pathname}?${q.toString()}`);
            }}
          />
          Exibir contas sem saldo
        </Label>
      )}
      {showSummaryOption && (
        <Label className="flex items-center gap-2 text-xs font-normal">
          <Checkbox
            checked={summary}
            onCheckedChange={(v) => {
              setSummary(v === true);
              const q = new URLSearchParams(params);
              if (v === true) q.set("resumo", "1");
              else q.delete("resumo");
              router.push(`${pathname}?${q.toString()}`);
            }}
          />
          Incluir resumo por grupo
        </Label>
      )}
      <Button variant="outline" size="sm" onClick={() => window.print()} className="ml-auto">
        <Printer /> Imprimir / PDF
      </Button>
    </div>
  );
}
