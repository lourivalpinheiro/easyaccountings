"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Filter, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { PeriodPresets } from "@/components/period-presets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableHead } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/accounting";
import {
  applyTableControls,
  compareValues,
  isFilterActive,
  normalize,
  writeTableParams,
  type Column,
  type ColumnFilter,
  type ColumnSpec,
  type Filters,
  type SortState,
} from "@/lib/table-controls";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/** Estado de ordenação/filtros compartilhado pelos cabeçalhos de uma tabela. */
export type TableControls = {
  specs: Map<string, ColumnSpec>;
  sort: SortState;
  filters: Filters;
  setSort: (sort: SortState) => void;
  setFilter: (id: string, filter: ColumnFilter | null) => void;
  clearAll: () => void;
  optionsFor: (id: string) => Option[];
};

/** Ordena e filtra no cliente uma lista já carregada (use antes da paginação). */
export function useTableControls<T>(rows: T[], columns: Column<T>[], initialSort: SortState = null) {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [filters, setFilters] = useState<Filters>({});
  const result = useMemo(() => applyTableControls(rows, columns, sort, filters), [rows, columns, sort, filters]);

  const controls: TableControls = {
    specs: new Map(columns.map((c) => [c.id, c])),
    sort,
    filters,
    setSort,
    setFilter: (id, filter) =>
      setFilters((prev) => {
        const next = { ...prev };
        if (filter && isFilterActive(filter)) next[id] = filter;
        else delete next[id];
        return next;
      }),
    clearAll: () => setFilters({}),
    optionsFor: (id) => {
      const col = columns.find((c) => c.id === id);
      if (!col) return [];
      if (col.options) return col.options;
      const distinct = [...new Set(rows.map((r) => String(col.value(r) ?? "")))].filter(Boolean);
      return distinct.sort(compareValues).map((v) => ({ value: v, label: v }));
    },
  };
  return { rows: result, controls };
}

/** Ordenação/filtros guardados na URL, para tabelas paginadas no servidor. */
export function useUrlTableControls(
  specs: ColumnSpec[],
  state: { sort: SortState; filters: Filters },
  options: Record<string, Option[]> = {},
): TableControls {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const push = (sort: SortState, filters: Filters) => {
    const p = new URLSearchParams(searchParams.toString());
    writeTableParams(p, sort, filters);
    p.set("pagina", "1");
    router.push(`${pathname}?${p.toString()}`);
  };
  return {
    specs: new Map(specs.map((s) => [s.id, s])),
    sort: state.sort,
    filters: state.filters,
    setSort: (sort) => push(sort, state.filters),
    setFilter: (id, filter) => {
      const next = { ...state.filters };
      if (filter && isFilterActive(filter)) next[id] = filter;
      else delete next[id];
      push(state.sort, next);
    },
    clearAll: () => push(state.sort, {}),
    optionsFor: (id) => options[id] ?? specs.find((s) => s.id === id)?.options ?? [],
  };
}

function describeFilter(spec: ColumnSpec, f: ColumnFilter, options: Option[]) {
  if (f.kind === "text") return `contém "${f.q.trim()}"`;
  if (f.kind === "values") {
    const labels = f.values.map((v) => options.find((o) => o.value === v)?.label ?? v);
    return labels.length > 2 ? `${labels.length} selecionados` : labels.join(", ");
  }
  const fmt = (v: string) => (spec.type === "date" ? formatDate(v) : spec.type === "money" ? formatMoney(Number(v)) : v);
  if (f.min && f.max) return `${fmt(f.min)} a ${fmt(f.max)}`;
  return f.min ? `a partir de ${fmt(f.min)}` : `até ${fmt(f.max!)}`;
}

/** Formulário do filtro de uma coluna; só aplica ao clicar em "Aplicar". */
function FilterEditor({
  spec,
  current,
  options,
  onApply,
}: {
  spec: ColumnSpec;
  current: ColumnFilter | undefined;
  options: Option[];
  onApply: (f: ColumnFilter | null) => void;
}) {
  const type = spec.type ?? "text";
  const [q, setQ] = useState(current?.kind === "text" ? current.q : "");
  const [min, setMin] = useState(current?.kind === "range" ? (current.min ?? "") : "");
  const [max, setMax] = useState(current?.kind === "range" ? (current.max ?? "") : "");
  const [values, setValues] = useState<string[]>(current?.kind === "values" ? current.values : []);
  const [search, setSearch] = useState("");

  const build = (): ColumnFilter =>
    type === "text"
      ? { kind: "text", q }
      : type === "select"
        ? { kind: "values", values }
        : { kind: "range", min: min || undefined, max: max || undefined };

  const visibleOptions = options.filter((o) => normalize(o.label).includes(normalize(search)));

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(build());
      }}
    >
      <div className="text-sm font-medium">Filtrar {spec.label.toLowerCase()}</div>
      {type === "text" && <Input autoFocus placeholder="Contém..." value={q} onChange={(e) => setQ(e.target.value)} />}
      {type === "date" && (
        <PeriodPresets value={{ from: min, to: max }} onSelect={(p) => onApply({ kind: "range", min: p.from, max: p.to })} />
      )}
      {(type === "number" || type === "money" || type === "date") && (
        <div className="grid grid-cols-2 gap-2">
          {(["De", "Até"] as const).map((label, i) => {
            const value = i === 0 ? min : max;
            const set = i === 0 ? setMin : setMax;
            return (
              <div key={label} className="grid gap-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                {type === "date" ? (
                  <Input type="date" value={value} onChange={(e) => set(e.target.value)} />
                ) : type === "money" ? (
                  <MoneyInput value={value ? Number(value) : 0} onChange={(c) => set(c ? String(c) : "")} />
                ) : (
                  <Input inputMode="numeric" value={value} onChange={(e) => set(e.target.value.replace(/[^\d-]/g, ""))} />
                )}
              </div>
            );
          })}
        </div>
      )}
      {type === "select" && (
        <div className="grid gap-2">
          {options.length > 8 && (
            <Input autoFocus placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          )}
          <label className="flex items-center gap-2 border-b pb-2 text-sm">
            <Checkbox
              checked={options.length > 0 && values.length === options.length}
              onCheckedChange={(v) => setValues(v === true ? options.map((o) => o.value) : [])}
            />
            Selecionar todos
          </label>
          <div className="grid max-h-56 gap-1.5 overflow-y-auto">
            {visibleOptions.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={values.includes(o.value)}
                  onCheckedChange={(v) =>
                    setValues((prev) => (v === true ? [...prev, o.value] : prev.filter((x) => x !== o.value)))
                  }
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
            {visibleOptions.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma opção.</span>}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onApply(null)}>
          Limpar
        </Button>
        <Button type="submit" size="sm">
          Aplicar
        </Button>
      </div>
    </form>
  );
}

/** Cabeçalho de coluna: clique no título ordena (crescente → decrescente → sem ordem); o funil filtra. */
export function ColumnHead({
  controls,
  id,
  className,
  children,
}: {
  controls: TableControls;
  id: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const spec = controls.specs.get(id);
  if (!spec) return <TableHead className={className}>{children}</TableHead>;
  const sortable = spec.sortable !== false;
  const filterable = spec.filterable !== false;
  const dir = controls.sort?.id === id ? controls.sort.dir : null;
  const active = isFilterActive(controls.filters[id]);
  const alignRight = className?.includes("text-right");
  const SortIcon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;

  const cycleSort = () => controls.setSort(dir === null ? { id, dir: "asc" } : dir === "asc" ? { id, dir: "desc" } : null);

  return (
    <TableHead className={className} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}>
      <div className={cn("flex items-center gap-0.5", alignRight && "justify-end")}>
        {sortable ? (
          <button
            type="button"
            onClick={cycleSort}
            className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted"
            title="Ordenar"
          >
            {children ?? spec.label}
            <SortIcon className={cn("size-3.5", dir ? "text-primary" : "text-muted-foreground/50")} />
          </button>
        ) : (
          (children ?? spec.label)
        )}
        {filterable && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn("rounded p-1 hover:bg-muted", active ? "text-primary" : "text-muted-foreground/50")}
                aria-label={`Filtrar ${spec.label}`}
                title="Filtrar"
              >
                <Filter className={cn("size-3.5", active && "fill-current")} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 font-normal" align={alignRight ? "end" : "start"}>
              <FilterEditor
                spec={spec}
                current={controls.filters[id]}
                options={controls.optionsFor(id)}
                onApply={(f) => {
                  controls.setFilter(id, f);
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TableHead>
  );
}

/** Filtros ativos como etiquetas removíveis, com atalho para limpar todos. */
export function ActiveFilters({ controls }: { controls: TableControls }) {
  const entries = Object.entries(controls.filters).filter(([, f]) => isFilterActive(f));
  if (entries.length === 0) return null;
  return (
    <div className="no-print flex flex-wrap items-center gap-2 text-xs">
      <Filter className="size-3.5 text-muted-foreground" />
      {entries.map(([id, f]) => {
        const spec = controls.specs.get(id);
        if (!spec) return null;
        return (
          <span key={id} className="flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-2.5">
            <span className="font-medium">{spec.label}:</span> {describeFilter(spec, f, controls.optionsFor(id))}
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-muted"
              onClick={() => controls.setFilter(id, null)}
              aria-label={`Remover filtro de ${spec.label}`}
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}
      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={controls.clearAll}>
        Limpar filtros
      </Button>
    </div>
  );
}
