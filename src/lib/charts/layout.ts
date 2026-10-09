/**
 * Geometria dos gráficos do planejamento: transforma os dados em primitivas (retângulos, linhas, caminhos, textos).
 * As mesmas primitivas são desenhadas no navegador (SVG) e no PDF, para que os gráficos fiquem idênticos.
 */
import { PALETTE } from "@/lib/plan/calc";
import type { ChartData, ChartType } from "@/lib/plan/types";

export type Prim =
  | { k: "rect"; x: number; y: number; w: number; h: number; fill: string }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number; dash?: string }
  | { k: "path"; d: string; fill: string; stroke: string; width: number; opacity?: number }
  | { k: "circle"; cx: number; cy: number; r: number; fill: string }
  | { k: "text"; x: number; y: number; text: string; size: number; anchor: "start" | "middle" | "end"; fill: string; bold?: boolean };

export type ChartTheme = { text: string; muted: string; grid: string; background: string };

export const LIGHT_THEME: ChartTheme = { text: "#111827", muted: "#6b7280", grid: "#e5e7eb", background: "#ffffff" };

const FONT = 10;
const charWidth = (size: number) => size * 0.56;
const textWidth = (s: string, size = FONT) => s.length * charWidth(size);
const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Valor compacto para eixos e rótulos ("12,3 mil", "1,2 mi"). Valores monetários chegam em centavos. */
export function compact(value: number, money: boolean) {
  const v = money ? value / 100 : value;
  const abs = Math.abs(v);
  const fmt = (n: number, d: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
  if (abs >= 1e9) return `${fmt(v / 1e9, 1)} bi`;
  if (abs >= 1e6) return `${fmt(v / 1e6, 1)} mi`;
  if (abs >= 1e3) return `${fmt(v / 1e3, 1)} mil`;
  return fmt(v, money ? 0 : 2);
}

export function fullValue(value: number, money: boolean) {
  return money
    ? (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Escala "redonda" para o eixo de valores. */
function niceScale(min: number, max: number, ticks = 5) {
  if (min === max) {
    max = min === 0 ? 1 : min + Math.abs(min);
    min = Math.min(0, min);
  }
  const raw = (max - min) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const values: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) values.push(Math.round(v * 1e6) / 1e6);
  return { lo, hi, values };
}

function legend(series: { name: string; color: string }[], width: number, y: number, theme: ChartTheme): Prim[] {
  const prims: Prim[] = [];
  const items = series.map((s) => ({ ...s, w: 14 + textWidth(truncate(s.name, 28)) + 14 }));
  const total = items.reduce((s, i) => s + i.w, 0);
  let x = Math.max(4, (width - total) / 2);
  for (const it of items) {
    prims.push({ k: "rect", x, y: y - 8, w: 9, h: 9, fill: it.color });
    prims.push({ k: "text", x: x + 13, y, text: truncate(it.name, 28), size: FONT, anchor: "start", fill: theme.muted });
    x += it.w;
  }
  return prims;
}

function cartesian(data: ChartData, type: ChartType, width: number, height: number, theme: ChartTheme): Prim[] {
  const prims: Prim[] = [];
  const stacked = type === "barras-empilhadas";
  const n = data.labels.length;
  const values = data.series.flatMap((s) => s.values);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (stacked) {
    for (let i = 0; i < n; i++) {
      const pos = data.series.reduce((s, x) => s + Math.max(0, x.values[i] ?? 0), 0);
      const neg = data.series.reduce((s, x) => s + Math.min(0, x.values[i] ?? 0), 0);
      max = Math.max(max, pos);
      min = Math.min(min, neg);
    }
  }
  const scale = niceScale(min, max);
  const axisLabels = scale.values.map((v) => compact(v, data.money));
  const left = Math.max(...axisLabels.map((l) => textWidth(l))) + 10;
  const showLegend = data.series.length > 1 || type !== "barras";
  const bottom = 22 + (showLegend ? 20 : 0);
  const top = 10;
  const right = 10;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const y = (v: number) => top + plotH - ((v - scale.lo) / (scale.hi - scale.lo)) * plotH;

  for (const [i, v] of scale.values.entries()) {
    prims.push({ k: "line", x1: left, y1: y(v), x2: width - right, y2: y(v), stroke: theme.grid, width: v === 0 ? 1 : 0.6 });
    prims.push({ k: "text", x: left - 6, y: y(v) + 3.5, text: axisLabels[i], size: FONT - 1, anchor: "end", fill: theme.muted });
  }

  const band = plotW / Math.max(1, n);
  const every = Math.max(1, Math.ceil((n * 46) / plotW));
  for (let i = 0; i < n; i++) {
    if (i % every !== 0) continue;
    prims.push({
      k: "text",
      x: left + band * (i + 0.5),
      y: top + plotH + 14,
      text: truncate(data.labels[i] ?? "", Math.max(4, Math.floor((band * every) / charWidth(FONT - 1)))),
      size: FONT - 1,
      anchor: "middle",
      fill: theme.muted,
    });
  }

  if (type === "linhas" || type === "area") {
    for (const s of data.series) {
      const pts = s.values.map((v, i) => [left + band * (i + 0.5), y(v ?? 0)] as const);
      if (pts.length === 0) continue;
      const line = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
      if (type === "area") {
        const base = y(Math.max(scale.lo, Math.min(0, scale.hi)));
        prims.push({
          k: "path",
          d: `${line} L${pts[pts.length - 1][0].toFixed(1)},${base.toFixed(1)} L${pts[0][0].toFixed(1)},${base.toFixed(1)} Z`,
          fill: s.color,
          stroke: "none",
          width: 0,
          opacity: 0.18,
        });
      }
      prims.push({ k: "path", d: line, fill: "none", stroke: s.color, width: 2 });
      if (pts.length <= 24) for (const [px, py] of pts) prims.push({ k: "circle", cx: px, cy: py, r: 2.5, fill: s.color });
    }
  } else {
    const groupW = band * 0.78;
    for (let i = 0; i < n; i++) {
      const x0 = left + band * i + (band - groupW) / 2;
      if (stacked) {
        let pos = 0;
        let neg = 0;
        for (const s of data.series) {
          const v = s.values[i] ?? 0;
          const from = v >= 0 ? pos : neg;
          const to = from + v;
          if (v >= 0) pos = to;
          else neg = to;
          prims.push({ k: "rect", x: x0, y: Math.min(y(from), y(to)), w: groupW, h: Math.abs(y(to) - y(from)), fill: s.color });
        }
      } else {
        const bw = groupW / Math.max(1, data.series.length);
        for (const [j, s] of data.series.entries()) {
          const v = s.values[i] ?? 0;
          prims.push({ k: "rect", x: x0 + bw * j + 0.5, y: Math.min(y(0), y(v)), w: Math.max(1, bw - 1), h: Math.abs(y(v) - y(0)), fill: s.color });
        }
      }
    }
  }
  if (showLegend) prims.push(...legend(data.series, width, height - 6, theme));
  return prims;
}

function horizontal(data: ChartData, width: number, height: number, theme: ChartTheme): Prim[] {
  const prims: Prim[] = [];
  const n = data.labels.length;
  const values = data.series.flatMap((s) => s.values);
  const scale = niceScale(Math.min(0, ...values), Math.max(0, ...values), 4);
  const labels = data.labels.map((l) => truncate(l, 22));
  const left = Math.min(width * 0.35, Math.max(...labels.map((l) => textWidth(l)), 20) + 10);
  const showLegend = data.series.length > 1;
  const top = 6;
  const bottom = 18 + (showLegend ? 20 : 0);
  const right = 14;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (v: number) => left + ((v - scale.lo) / (scale.hi - scale.lo)) * plotW;
  for (const v of scale.values) {
    prims.push({ k: "line", x1: x(v), y1: top, x2: x(v), y2: top + plotH, stroke: theme.grid, width: v === 0 ? 1 : 0.6 });
    prims.push({ k: "text", x: x(v), y: top + plotH + 12, text: compact(v, data.money), size: FONT - 1, anchor: "middle", fill: theme.muted });
  }
  const band = plotH / Math.max(1, n);
  const groupH = band * 0.75;
  for (let i = 0; i < n; i++) {
    const y0 = top + band * i + (band - groupH) / 2;
    prims.push({ k: "text", x: left - 6, y: top + band * (i + 0.5) + 3.5, text: labels[i], size: FONT - 1, anchor: "end", fill: theme.text });
    const bh = groupH / Math.max(1, data.series.length);
    for (const [j, s] of data.series.entries()) {
      const v = s.values[i] ?? 0;
      prims.push({ k: "rect", x: Math.min(x(0), x(v)), y: y0 + bh * j + 0.5, w: Math.abs(x(v) - x(0)), h: Math.max(1, bh - 1), fill: s.color });
    }
  }
  if (showLegend) prims.push(...legend(data.series, width, height - 6, theme));
  return prims;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return { x0, y0, x1, y1, large: a1 - a0 > Math.PI ? 1 : 0 };
}

function pie(data: ChartData, donut: boolean, width: number, height: number, theme: ChartTheme): Prim[] {
  const prims: Prim[] = [];
  const s = data.series[0];
  if (!s) return prims;
  const slices = data.labels
    .map((label, i) => ({ label, value: Math.max(0, s.values[i] ?? 0), color: PALETTE[i % PALETTE.length] }))
    .filter((x) => x.value > 0);
  const total = slices.reduce((t, x) => t + x.value, 0);
  const legendW = Math.min(width * 0.5, 230);
  const r = Math.min((width - legendW) / 2, height / 2) - 8;
  const cx = (width - legendW) / 2;
  const cy = height / 2;
  if (total === 0 || r <= 0) {
    prims.push({ k: "text", x: width / 2, y: height / 2, text: "Sem valores para exibir", size: FONT, anchor: "middle", fill: theme.muted });
    return prims;
  }
  let a = 0;
  for (const [i, sl] of slices.entries()) {
    const color = sl.color;
    const a1 = a + (sl.value / total) * Math.PI * 2;
    if (slices.length === 1) {
      prims.push({ k: "circle", cx, cy, r, fill: color });
    } else {
      const o = arc(cx, cy, r, a, a1);
      prims.push({
        k: "path",
        d: `M${cx},${cy} L${o.x0.toFixed(2)},${o.y0.toFixed(2)} A${r},${r} 0 ${o.large} 1 ${o.x1.toFixed(2)},${o.y1.toFixed(2)} Z`,
        fill: color,
        stroke: theme.background,
        width: 1,
      });
    }
    // Legenda à direita: cor, nome e percentual.
    const ly = 14 + i * 16;
    if (ly < height - 4) {
      const lx = width - legendW + 8;
      prims.push({ k: "rect", x: lx, y: ly - 8, w: 9, h: 9, fill: color });
      prims.push({ k: "text", x: lx + 14, y: ly, text: truncate(sl.label, 22), size: FONT, anchor: "start", fill: theme.text });
      prims.push({
        k: "text",
        x: width - 4,
        y: ly,
        text: `${((sl.value / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
        size: FONT,
        anchor: "end",
        fill: theme.muted,
      });
    }
    a = a1;
  }
  if (donut) {
    prims.push({ k: "circle", cx, cy, r: r * 0.58, fill: theme.background });
    prims.push({ k: "text", x: cx, y: cy - 2, text: "Total", size: FONT - 1, anchor: "middle", fill: theme.muted });
    prims.push({ k: "text", x: cx, y: cy + 11, text: compact(total, data.money), size: FONT + 1, anchor: "middle", fill: theme.text, bold: true });
  }
  return prims;
}

export function layoutChart(data: ChartData, type: ChartType, width: number, height: number, theme: ChartTheme = LIGHT_THEME): Prim[] {
  if (data.labels.length === 0 || data.series.length === 0) {
    return [{ k: "text", x: width / 2, y: height / 2, text: "Sem dados para exibir", size: FONT, anchor: "middle", fill: theme.muted }];
  }
  if (type === "pizza" || type === "rosca") return pie(data, type === "rosca", width, height, theme);
  if (type === "barras-horizontais") return horizontal(data, width, height, theme);
  return cartesian(data, type, width, height, theme);
}
