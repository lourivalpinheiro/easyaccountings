import type { CalendarMonth } from "@/lib/data/cash-flow";
import { bandFor } from "@/components/cash-thermometer";
import { cn } from "@/lib/utils";

function formatCompact(cents: number) {
  const reais = cents / 100;
  const abs = Math.abs(reais);
  const sign = reais < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(2)}K`;
  return `${sign}${Math.round(abs)}`;
}

/** Calendário de saldo final por dia: real até hoje, previsto pelas movimentações agendadas nos dias seguintes. */
export function CashCalendarHeatmap({ months }: { months: CalendarMonth[] }) {
  const maxDays = Math.max(...months.map((m) => m.days.length));
  const gridCols = `3rem repeat(${months.length}, minmax(4.25rem, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="grid text-xs" style={{ gridTemplateColumns: gridCols }}>
        <div className="sticky left-0 z-10 border-b bg-muted/60" />
        {months.map((m) => (
          <div key={`${m.year}-${m.month}`} className="border-b border-l bg-muted/60 px-2 py-1.5 text-center font-medium">
            {m.label}
          </div>
        ))}
        {Array.from({ length: maxDays }, (_, i) => i + 1).map((day) => (
          <div key={day} className="contents">
            <div className="sticky left-0 z-10 border-b bg-background px-2 py-1 text-right text-muted-foreground">{day}</div>
            {months.map((m) => {
              const cell = m.days[day - 1];
              if (!cell) return <div key={`${m.year}-${m.month}-${day}`} className="border-b border-l" />;
              const band = bandFor(cell.balance);
              return (
                <div
                  key={`${m.year}-${m.month}-${day}`}
                  title={`${cell.date}${cell.projected ? " (previsto)" : ""}: ${band.label}`}
                  className={cn(
                    "border-b border-l px-2 py-1 text-right tabular-nums text-white/90",
                    band.bar,
                    cell.projected && "opacity-60",
                  )}
                >
                  {formatCompact(cell.balance)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
