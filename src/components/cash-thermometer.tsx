import { formatMoney } from "@/lib/accounting";
import { cn } from "@/lib/utils";

export const BANDS = [
  { id: "blue", min: 1_000_000, label: "Acima de R$ 10 mil", bar: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  { id: "green", min: 100_000, label: "R$ 1 mil a R$ 10 mil", bar: "bg-emerald-400", text: "text-emerald-600 dark:text-emerald-400" },
  { id: "yellow", min: 1, label: "R$ 1 a R$ 999", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { id: "red", min: -Infinity, label: "Zero ou negativo", bar: "bg-destructive", text: "text-destructive" },
] as const;

export function bandFor(cents: number) {
  return BANDS.find((b) => cents >= b.min) ?? BANDS[BANDS.length - 1];
}

/** Gráfico em formato de termômetro: faixas de risco do saldo de caixa, com a faixa atual em destaque. */
export function CashThermometer({ cents }: { cents: number }) {
  const active = bandFor(cents);
  return (
    <div className="flex items-center gap-4">
      <div className="flex w-10 flex-col-reverse gap-1" role="img" aria-label={`Saldo na faixa: ${active.label}`}>
        {[...BANDS].reverse().map((b) => (
          <div
            key={b.id}
            className={cn(
              "h-10 rounded-md opacity-30 transition-opacity",
              b.bar,
              b.id === active.id && "opacity-100 ring-2 ring-foreground/30",
            )}
          />
        ))}
      </div>
      <div className="grid gap-1 text-sm">
        {[...BANDS].reverse().map((b) => (
          <div key={b.id} className={cn("flex items-center gap-2", b.id !== active.id && "text-muted-foreground")}>
            <span className={cn("size-2 rounded-full", b.bar)} />
            {b.label}
            {b.id === active.id && <span className={cn("font-semibold", b.text)}>← {formatMoney(Math.abs(cents))}{cents < 0 ? " (negativo)" : ""}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
