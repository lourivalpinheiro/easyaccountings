"use client";

import { layoutChart, type ChartTheme, type Prim } from "@/lib/charts/layout";
import type { ChartData, ChartType } from "@/lib/plan/types";

/** Cores do tema atual (claro/escuro) via variáveis CSS. */
const DOM_THEME: ChartTheme = {
  text: "var(--foreground)",
  muted: "var(--muted-foreground)",
  grid: "var(--border)",
  background: "var(--card)",
};

export const CHART_WIDTH = 640;

function Primitive({ p }: { p: Prim }) {
  switch (p.k) {
    case "rect":
      return <rect x={p.x} y={p.y} width={Math.max(0, p.w)} height={Math.max(0, p.h)} style={{ fill: p.fill }} rx={1} />;
    case "line":
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} style={{ stroke: p.stroke, strokeWidth: p.width }} strokeDasharray={p.dash} />;
    case "path":
      return (
        <path
          d={p.d}
          style={{ fill: p.fill, stroke: p.stroke, strokeWidth: p.width, fillOpacity: p.opacity }}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case "circle":
      return <circle cx={p.cx} cy={p.cy} r={p.r} style={{ fill: p.fill }} />;
    case "text":
      return (
        <text x={p.x} y={p.y} textAnchor={p.anchor} style={{ fill: p.fill, fontSize: p.size, fontWeight: p.bold ? 600 : 400 }}>
          {p.text}
        </text>
      );
  }
}

export function ChartSvg({ data, type, height = 280, title }: { data: ChartData; type: ChartType; height?: number; title?: string }) {
  const prims = layoutChart(data, type, CHART_WIDTH, height, DOM_THEME);
  return (
    <figure className="grid gap-1">
      {title && <figcaption className="text-center text-sm font-semibold">{title}</figcaption>}
      <svg viewBox={`0 0 ${CHART_WIDTH} ${height}`} className="h-auto w-full" role="img" aria-label={title || "Gráfico"}>
        {prims.map((p, i) => (
          <Primitive key={i} p={p} />
        ))}
      </svg>
    </figure>
  );
}
