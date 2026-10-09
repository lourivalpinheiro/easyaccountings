"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { usePlan } from "@/components/plan/plan-context";
import { ChartSvg } from "@/components/plan/chart-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FLOW_TYPE_LABELS, FLOW_TYPES, type FlowType } from "@/lib/cash-flow-types";
import { chartData } from "@/lib/plan/calc";
import {
  CHART_SOURCE_LABELS,
  CHART_SOURCES,
  CHART_TYPE_LABELS,
  CHART_TYPES,
  type ChartSource,
  type ChartSpec,
  type ChartType,
} from "@/lib/plan/types";

const MULTI_TYPE_SOURCES: ChartSource[] = ["fluxo-ano", "fluxo-diagnostico"];
const SINGLE_TYPE_SOURCES: ChartSource[] = ["categorias", "orcado-realizado-mensal", "orcado-realizado-categorias"];

function ManualDataEditor({ value, onChange }: { value: ChartSpec["manual"]; onChange: (v: ChartSpec["manual"]) => void }) {
  const setLabel = (i: number, label: string) => onChange({ ...value, labels: value.labels.map((l, j) => (j === i ? label : l)) });
  const setName = (k: number, name: string) => onChange({ ...value, series: value.series.map((s, j) => (j === k ? { ...s, name } : s)) });
  const setValue = (k: number, i: number, text: string) => {
    const n = Number(text.replace(/\./g, "").replace(",", "."));
    onChange({
      ...value,
      series: value.series.map((s, j) => (j === k ? { ...s, values: s.values.map((v, x) => (x === i ? (Number.isFinite(n) ? n : 0) : v)) } : s)),
    });
  };
  const addRow = () =>
    onChange({ labels: [...value.labels, `Item ${value.labels.length + 1}`], series: value.series.map((s) => ({ ...s, values: [...s.values, 0] })) });
  const removeRow = (i: number) =>
    onChange({ labels: value.labels.filter((_, j) => j !== i), series: value.series.map((s) => ({ ...s, values: s.values.filter((_, j) => j !== i) })) });
  const addSeries = () =>
    onChange({ ...value, series: [...value.series, { name: `Série ${value.series.length + 1}`, values: value.labels.map(() => 0) }] });
  const removeSeries = (k: number) => onChange({ ...value, series: value.series.filter((_, j) => j !== k) });

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="p-1 text-left font-medium">Rótulo</th>
              {value.series.map((s, k) => (
                <th key={k} className="p-1">
                  <div className="flex items-center gap-1">
                    <Input value={s.name} onChange={(e) => setName(k, e.target.value)} className="h-8 min-w-24" aria-label="Nome da série" />
                    {value.series.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => removeSeries(k)} aria-label="Remover série">
                        <X />
                      </Button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {value.labels.map((label, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-1">
                  <Input value={label} onChange={(e) => setLabel(i, e.target.value)} className="h-8 min-w-28" aria-label="Rótulo" />
                </td>
                {value.series.map((s, k) => (
                  <td key={k} className="p-1">
                    <Input
                      defaultValue={String(s.values[i] ?? 0).replace(".", ",")}
                      onBlur={(e) => setValue(k, i, e.target.value)}
                      inputMode="decimal"
                      className="h-8 min-w-20 text-right tabular-nums"
                      aria-label={`Valor de ${label} em ${s.name}`}
                    />
                  </td>
                ))}
                <td className="p-1">
                  {value.labels.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => removeRow(i)} aria-label="Remover linha">
                      <X />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus /> Linha
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addSeries}>
          <Plus /> Série
        </Button>
      </div>
    </div>
  );
}

/** Montagem do gráfico: tipo, origem dos dados, filtros e prévia ao vivo. */
export function ChartDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: ChartSpec;
  onSave: (spec: ChartSpec) => void;
  onClose: () => void;
}) {
  const { dataset, inputs } = usePlan();
  const [spec, setSpec] = useState<ChartSpec>(initial);
  const set = (patch: Partial<ChartSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const multi = MULTI_TYPE_SOURCES.includes(spec.source);
  const single = SINGLE_TYPE_SOURCES.includes(spec.source);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Gráfico</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div className="grid content-start gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ch-title">Título</Label>
              <Input id="ch-title" value={spec.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Tipo de gráfico</Label>
              <Select value={spec.chartType} onValueChange={(v) => set({ chartType: v as ChartType })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {CHART_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CHART_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Dados</Label>
              <Select
                value={spec.source}
                onValueChange={(v) => {
                  const source = v as ChartSource;
                  set({ source, types: SINGLE_TYPE_SOURCES.includes(source) ? [spec.types[0] ?? "saida"] : spec.types });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {CHART_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CHART_SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {multi && (
              <div className="grid gap-2">
                <Label>Séries</Label>
                {FLOW_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={spec.types.includes(t)}
                      onCheckedChange={(v) =>
                        set({ types: v === true ? FLOW_TYPES.filter((x) => x === t || spec.types.includes(x)) : spec.types.filter((x) => x !== t) })
                      }
                    />
                    {FLOW_TYPE_LABELS[t].plural}
                  </label>
                ))}
              </div>
            )}
            {single && (
              <div className="grid gap-2">
                <Label>Tipo de movimentação</Label>
                <Select value={spec.types[0] ?? "saida"} onValueChange={(v) => set({ types: [v as FlowType] })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {FLOW_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {FLOW_TYPE_LABELS[t].plural}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {spec.source === "categorias" && (
              <div className="grid gap-2">
                <Label>Período</Label>
                <Select value={spec.period} onValueChange={(v) => set({ period: v as ChartSpec["period"] })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="diagnostico">Período do diagnóstico</SelectItem>
                    <SelectItem value="ano">Ano do plano (realizado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(spec.source === "categorias" || spec.source === "orcado-realizado-categorias") && (
              <div className="grid gap-2">
                <Label htmlFor="ch-limit">Quantidade de categorias</Label>
                <Input
                  id="ch-limit"
                  type="number"
                  min={1}
                  max={30}
                  value={spec.limit}
                  onChange={(e) => set({ limit: Math.min(30, Math.max(1, Math.floor(Number(e.target.value)) || 1)) })}
                />
              </div>
            )}
            {spec.source === "cenarios" && (
              <div className="grid gap-2">
                <Label>Valor projetado</Label>
                <Select value={spec.metric} onValueChange={(v) => set({ metric: v as ChartSpec["metric"] })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="total">Patrimônio (caixa + aplicações)</SelectItem>
                    <SelectItem value="caixa">Saldo de caixa</SelectItem>
                    <SelectItem value="aplicado">Aplicações</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid content-start gap-3">
            {spec.source === "manual" && <ManualDataEditor value={spec.manual} onChange={(manual) => set({ manual })} />}
            <div className="rounded-md border p-3">
              <ChartSvg data={chartData(spec, dataset, inputs)} type={spec.chartType} title={spec.title} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onSave(spec)}>
            Inserir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
