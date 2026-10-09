"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { compact, fullValue } from "@/lib/charts/layout";
import { PALETTE } from "@/lib/plan/calc";
import type { ChartData, ChartType } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

/** Linha do gráfico: rótulo + uma coluna por série (s0, s1...) ou, na pizza, a fatia (key/value/fill). */
type Row = { label?: string; key?: string; value?: number; fill?: string; [serie: string]: string | number | undefined };

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Legenda clicável: mostra/esconde cada série (ou fatia, na pizza/rosca). */
function ToggleLegend({
  items,
  hidden,
  onToggle,
}: {
  items: { key: string; label: string; color: string }[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-1 text-xs">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onToggle(it.key)}
          className={cn("flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted", hidden.has(it.key) && "opacity-40 line-through")}
          title={hidden.has(it.key) ? "Mostrar" : "Esconder"}
        >
          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: it.color }} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Gráfico interativo (shadcn/Recharts) com dica ao passar o mouse e legenda clicável. */
export function InteractiveChart({
  data,
  type,
  title,
  height = 300,
}: {
  data: ChartData;
  type: ChartType;
  title?: string;
  height?: number;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isPie = type === "pizza" || type === "rosca";

  // Séries viram chaves s0, s1...; fatias da pizza viram p0, p1...
  const { rows, config, legend } = useMemo((): { rows: Row[]; config: ChartConfig; legend: { key: string; label: string; color: string }[] } => {
    if (isPie) {
      const s = data.series[0];
      const slices = data.labels
        .map((label, i) => ({ key: `p${i}`, label, value: Math.max(0, s?.values[i] ?? 0), color: PALETTE[i % PALETTE.length] }))
        .filter((x) => x.value > 0);
      return {
        rows: slices.map((x) => ({ key: x.key, value: x.value, fill: `var(--color-${x.key})` })),
        config: Object.fromEntries(slices.map((x) => [x.key, { label: x.label, color: x.color }])),
        legend: slices.map((x) => ({ key: x.key, label: x.label, color: x.color })),
      };
    }
    return {
      rows: data.labels.map((label, i) => ({
        label,
        ...Object.fromEntries(data.series.map((s, j) => [`s${j}`, s.values[i] ?? 0])),
      })),
      config: Object.fromEntries(data.series.map((s, j) => [`s${j}`, { label: s.name, color: s.color }])),
      legend: data.series.map((s, j) => ({ key: `s${j}`, label: s.name, color: s.color })),
    };
  }, [data, isPie]);

  const empty = data.labels.length === 0 || data.series.length === 0 || (isPie && rows.length === 0);
  const tick = (v: number) => compact(Number(v), data.money);
  const tooltip = (
    <ChartTooltip
      cursor={!isPie}
      content={
        <ChartTooltipContent
          nameKey={isPie ? "key" : undefined}
          formatter={(value, name, item) => (
            <div className="flex w-full items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.payload?.fill ?? item.color }} />
              <span className="text-muted-foreground">{config[String(isPie ? item.payload?.key : name)]?.label ?? name}</span>
              <span className="ml-auto font-mono font-medium tabular-nums">{fullValue(Number(value), data.money)}</span>
            </div>
          )}
        />
      }
    />
  );
  const visibleSeries = legend.filter((l) => !hidden.has(l.key));

  let chart: React.ReactElement;
  if (isPie) {
    const slices = rows.filter((r) => !hidden.has(r.key!));
    const total = slices.reduce((sum, r) => sum + (r.value ?? 0), 0);
    chart = (
      <PieChart>
        {tooltip}
        <Pie
          data={slices}
          dataKey="value"
          nameKey="key"
          innerRadius={type === "rosca" ? "55%" : 0}
          outerRadius="85%"
          strokeWidth={2}
          stroke="var(--card)"
          isAnimationActive
        >
          {slices.map((r) => (
            <Cell key={r.key} fill={r.fill} />
          ))}
        </Pie>
        {type === "rosca" && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-sm font-semibold">
            {compact(total, data.money)}
          </text>
        )}
      </PieChart>
    );
  } else if (type === "barras-horizontais") {
    chart = (
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickFormatter={tick} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={130} tickLine={false} axisLine={false} tickFormatter={(v: string) => truncate(v, 20)} />
        {tooltip}
        {visibleSeries.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={3} />
        ))}
      </BarChart>
    );
  } else if (type === "linhas") {
    chart = (
      <LineChart data={rows} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickFormatter={tick} tickLine={false} axisLine={false} width={64} />
        {tooltip}
        {visibleSeries.map((s) => (
          <Line key={s.key} dataKey={s.key} stroke={`var(--color-${s.key})`} strokeWidth={2} type="monotone" dot={rows.length <= 24} />
        ))}
      </LineChart>
    );
  } else if (type === "area") {
    chart = (
      <AreaChart data={rows} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickFormatter={tick} tickLine={false} axisLine={false} width={64} />
        {tooltip}
        {visibleSeries.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            stroke={`var(--color-${s.key})`}
            fill={`var(--color-${s.key})`}
            fillOpacity={0.2}
            strokeWidth={2}
            type="monotone"
          />
        ))}
      </AreaChart>
    );
  } else {
    const stacked = type === "barras-empilhadas";
    chart = (
      <BarChart data={rows} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} tickFormatter={(v: string) => truncate(v, 12)} />
        <YAxis tickFormatter={tick} tickLine={false} axisLine={false} width={64} />
        {tooltip}
        {visibleSeries.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            stackId={stacked ? "a" : undefined}
            radius={stacked ? (i === visibleSeries.length - 1 ? [3, 3, 0, 0] : 0) : [3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    );
  }

  return (
    <figure className="grid gap-1">
      {title && <figcaption className="text-center text-sm font-semibold">{title}</figcaption>}
      {empty ? (
        <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
          Sem dados para exibir
        </div>
      ) : (
        <>
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
            {chart}
          </ChartContainer>
          {(legend.length > 1 || isPie) && <ToggleLegend items={legend} hidden={hidden} onToggle={toggle} />}
        </>
      )}
    </figure>
  );
}
