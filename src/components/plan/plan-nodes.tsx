"use client";

import { Node, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { BlockView } from "@/components/plan/block-view";
import { ChartDialog } from "@/components/plan/chart-dialog";
import { InteractiveChart } from "@/components/interactive-chart";
import { usePlan } from "@/components/plan/plan-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FLOW_TYPE_LABELS, FLOW_TYPES, type FlowType } from "@/lib/cash-flow-types";
import { blockModel } from "@/lib/plan/blocks";
import { chartData, DEFAULT_CHART } from "@/lib/plan/calc";
import type { BlockKind, ChartSpec } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

function NodeFrame({ selected, editable, actions, children }: { selected: boolean; editable: boolean; actions: React.ReactNode; children: React.ReactNode }) {
  return (
    <NodeViewWrapper
      className={cn("group relative my-3 rounded-md border bg-card p-3", selected && editable && "ring-2 ring-primary")}
      contentEditable={false}
      data-drag-handle
    >
      {editable && (
        <div className="no-print absolute top-1.5 right-1.5 z-[1] flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          {actions}
        </div>
      )}
      {children}
    </NodeViewWrapper>
  );
}

function ChartNodeView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const { dataset, inputs } = usePlan();
  const spec = { ...DEFAULT_CHART, ...(node.attrs.spec as Partial<ChartSpec>) };
  const [editing, setEditing] = useState(false);
  return (
    <NodeFrame
      selected={selected}
      editable={editor.isEditable}
      actions={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil /> Editar gráfico
          </Button>
          <Button type="button" size="icon" variant="secondary" className="size-8" onClick={deleteNode} aria-label="Remover gráfico">
            <Trash2 className="text-destructive" />
          </Button>
        </>
      }
    >
      <InteractiveChart data={chartData(spec, dataset, inputs)} type={spec.chartType} title={spec.title} />
      {editing && (
        <ChartDialog
          open
          initial={spec}
          onClose={() => setEditing(false)}
          onSave={(next) => {
            updateAttributes({ spec: next });
            setEditing(false);
          }}
        />
      )}
    </NodeFrame>
  );
}

function BlockNodeView({ node, updateAttributes, deleteNode, selected, editor }: ReactNodeViewProps) {
  const { dataset, inputs } = usePlan();
  const kind = node.attrs.kind as BlockKind;
  const type = (node.attrs.type as FlowType) ?? "saida";
  const limit = Number(node.attrs.limit) || 8;
  const hasType = kind === "categorias" || kind === "orcado-realizado";
  return (
    <NodeFrame
      selected={selected}
      editable={editor.isEditable}
      actions={
        <>
          {hasType && (
            <Select value={type} onValueChange={(v) => updateAttributes({ type: v })}>
              <SelectTrigger size="sm" className="w-40 bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLOW_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FLOW_TYPE_LABELS[t].plural}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {kind === "categorias" && (
            <Input
              type="number"
              min={1}
              max={30}
              value={limit}
              onChange={(e) => updateAttributes({ limit: Math.min(30, Math.max(1, Math.floor(Number(e.target.value)) || 1)) })}
              className="h-8 w-16 bg-secondary"
              aria-label="Quantidade de categorias"
            />
          )}
          <Button type="button" size="icon" variant="secondary" className="size-8" onClick={deleteNode} aria-label="Remover bloco">
            <Trash2 className="text-destructive" />
          </Button>
        </>
      }
    >
      <BlockView model={blockModel(kind, { type, limit }, dataset, inputs)} />
    </NodeFrame>
  );
}

/** Gráfico montado pelo usuário; os dados vêm do plano no momento em que é exibido. */
export const PlanChart = Node.create({
  name: "planChart",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      spec: {
        default: DEFAULT_CHART,
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute("data-plan-chart") ?? "");
          } catch {
            return DEFAULT_CHART;
          }
        },
        renderHTML: (attrs) => ({ "data-plan-chart": JSON.stringify(attrs.spec) }),
      },
    };
  },
  parseHTML: () => [{ tag: "div[data-plan-chart]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", HTMLAttributes],
  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView);
  },
});

/** Bloco de dados do plano (indicadores, metas, orçamento, controle, cenários...). */
export const PlanBlock = Node.create({
  name: "planBlock",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      kind: { default: "indicadores", parseHTML: (el) => el.getAttribute("data-plan-block"), renderHTML: (a) => ({ "data-plan-block": a.kind }) },
      type: { default: "saida", parseHTML: (el) => el.getAttribute("data-type"), renderHTML: (a) => ({ "data-type": a.type }) },
      limit: { default: 8, parseHTML: (el) => Number(el.getAttribute("data-limit")) || 8, renderHTML: (a) => ({ "data-limit": a.limit }) },
    };
  },
  parseHTML: () => [{ tag: "div[data-plan-block]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", HTMLAttributes],
  addNodeView() {
    return ReactNodeViewRenderer(BlockNodeView);
  },
});
