"use client";

import { Button } from "@/components/ui/button";
import { monthRangeIso, todayIso } from "@/lib/period";
import { cn } from "@/lib/utils";

export type Period = { from: string; to: string };

/** Atalhos de período usados em todo o sistema (datas no fuso de Brasília). */
export function periodPresets(): (Period & { label: string })[] {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  const prev = monthRangeIso(m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`);
  return [
    { label: "Mês atual", ...monthRangeIso(today) },
    { label: "Mês anterior", ...prev },
    { label: "Ano atual", from: `${y}-01-01`, to: `${y}-12-31` },
  ];
}

/** Botões de período rápido; o ativo fica destacado. */
export function PeriodPresets({
  value,
  onSelect,
  className,
  size = "sm",
}: {
  value?: Partial<Period>;
  onSelect: (period: Period) => void;
  className?: string;
  size?: "sm" | "xs";
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {periodPresets().map((p) => {
        const active = value?.from === p.from && value?.to === p.to;
        return (
          <Button
            key={p.label}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            className={cn(size === "xs" && "h-7 px-2 text-xs")}
            onClick={() => onSelect({ from: p.from, to: p.to })}
          >
            {p.label}
          </Button>
        );
      })}
    </div>
  );
}
