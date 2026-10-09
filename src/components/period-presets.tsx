"use client";

import { CalendarDays, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/accounting";
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

const pill = (active: boolean) =>
  cn(
    "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
    active ? "border-primary bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  );

/** Pílulas de período rápido (usadas também dentro do filtro das colunas). */
export function PeriodPresets({ value, onSelect, className }: { value?: Partial<Period>; onSelect: (period: Period) => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {periodPresets().map((p) => (
        <button key={p.label} type="button" className={pill(value?.from === p.from && value?.to === p.to)} onClick={() => onSelect({ from: p.from, to: p.to })}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Seletor de período compacto: pílulas com os atalhos e uma pílula com o período atual
 * que abre um calendário de intervalo.
 */
export function PeriodPicker({
  value,
  onChange,
  onClear,
  className,
}: {
  /** Nulo = sem filtro de período ("Todo o período"). */
  value: Period | null;
  onChange: (period: Period) => void;
  /** Quando informado, mostra um botão para remover o período. */
  onClear?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();
  const isPreset = !value || periodPresets().some((p) => p.from === value.from && p.to === value.to);

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <PeriodPresets value={value ?? undefined} onSelect={onChange} />
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setRange(value ? { from: toDate(value.from), to: toDate(value.to) } : undefined);
        }}
      >
        <PopoverTrigger asChild>
          <button type="button" className={pill(!isPreset)} aria-label="Escolher período">
            <CalendarDays className="size-3.5" />
            <span className="tabular-nums">{value ? `${formatDate(value.from)} – ${formatDate(value.to)}` : "Todo o período"}</span>
            <ChevronDown className="size-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            resetOnSelect
            locale={ptBR}
            numberOfMonths={2}
            defaultMonth={range?.from}
            selected={range}
            onSelect={setRange}
            className="[--cell-size:--spacing(8)]"
          />
          <div className="flex items-center justify-between gap-2 border-t p-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {range?.from ? formatDate(toIso(range.from)) : "Início"} – {range?.to ? formatDate(toIso(range.to)) : "fim"}
            </span>
            <Button
              size="sm"
              disabled={!range?.from || !range?.to}
              onClick={() => {
                if (!range?.from || !range?.to) return;
                onChange({ from: toIso(range.from), to: toIso(range.to) });
                setOpen(false);
              }}
            >
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {value && onClear && (
        <button type="button" className={cn(pill(false), "px-2")} onClick={onClear} aria-label="Remover período" title="Remover período">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
