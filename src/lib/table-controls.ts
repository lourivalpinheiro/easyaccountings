/** Ordenação e filtros por coluna das tabelas: tipos, aplicação no cliente e (de)serialização na URL. */

export type ColumnType = "text" | "number" | "money" | "date" | "select";
export type SortDir = "asc" | "desc";
export type SortState = { id: string; dir: SortDir } | null;

/**
 * - text: contém o texto (sem diferenciar maiúsculas/acentos)
 * - range: mínimo/máximo (number e money em centavos; date em AAAA-MM-DD)
 * - values: um dos valores marcados (select)
 */
export type ColumnFilter =
  | { kind: "text"; q: string }
  | { kind: "range"; min?: string; max?: string }
  | { kind: "values"; values: string[] };

export type Filters = Record<string, ColumnFilter>;

export type ColumnSpec = {
  id: string;
  label: string;
  type?: ColumnType;
  /** Opções fixas para colunas `select`; sem elas, as opções vêm dos valores distintos das linhas. */
  options?: { value: string; label: string }[];
  sortable?: boolean;
  filterable?: boolean;
};

export type Column<T> = ColumnSpec & {
  /** Valor usado para ordenar e filtrar (centavos para money, AAAA-MM-DD para date). */
  value: (row: T) => string | number | boolean | null | undefined;
};

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

export function compareValues(a: unknown, b: unknown) {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1; // vazios por último
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}

export function isFilterActive(f: ColumnFilter | undefined) {
  if (!f) return false;
  if (f.kind === "text") return f.q.trim() !== "";
  if (f.kind === "range") return Boolean(f.min || f.max);
  return f.values.length > 0;
}

export function matchesFilter(value: unknown, f: ColumnFilter, type: ColumnType = "text") {
  if (f.kind === "text") return normalize(String(value ?? "")).includes(normalize(f.q.trim()));
  if (f.kind === "values") return f.values.includes(String(value ?? ""));
  if (value === null || value === undefined || value === "") return false;
  if (type === "date") {
    const v = String(value).slice(0, 10);
    return (!f.min || v >= f.min) && (!f.max || v <= f.max);
  }
  const n = Number(value);
  return (!f.min || n >= Number(f.min)) && (!f.max || n <= Number(f.max));
}

export function applyTableControls<T>(rows: T[], columns: Column<T>[], sort: SortState, filters: Filters) {
  const byId = new Map(columns.map((c) => [c.id, c]));
  let out = rows;
  for (const [id, f] of Object.entries(filters)) {
    const col = byId.get(id);
    if (!col || !isFilterActive(f)) continue;
    out = out.filter((r) => matchesFilter(col.value(r), f, col.type));
  }
  const sortCol = sort && byId.get(sort.id);
  if (sort && sortCol) {
    const dir = sort.dir === "asc" ? 1 : -1;
    const isEmpty = (v: unknown) => v === null || v === undefined || v === "";
    out = [...out].sort((a, b) => {
      const va = sortCol.value(a);
      const vb = sortCol.value(b);
      // Vazios ficam por último nas duas direções.
      if (isEmpty(va) || isEmpty(vb)) return compareValues(va, vb);
      return compareValues(va, vb) * dir;
    });
  }
  return out;
}

// ---------- URL (tabelas paginadas no servidor) ----------

type Params = Record<string, string | string[] | undefined>;

/** `ord=coluna.asc`; filtros em `f.coluna`: texto, `min~max` ou valores separados por `|`. */
export function readTableParams(params: Params, specs: ColumnSpec[]): { sort: SortState; filters: Filters } {
  let sort: SortState = null;
  if (typeof params.ord === "string") {
    const [id, dir] = params.ord.split(".");
    if (specs.some((s) => s.id === id && s.sortable !== false) && (dir === "asc" || dir === "desc")) sort = { id, dir };
  }
  const filters: Filters = {};
  for (const spec of specs) {
    const raw = params[`f.${spec.id}`];
    if (typeof raw !== "string" || raw === "" || spec.filterable === false) continue;
    const type = spec.type ?? "text";
    if (type === "text") filters[spec.id] = { kind: "text", q: raw.slice(0, 100) };
    else if (type === "select") filters[spec.id] = { kind: "values", values: raw.split("|").slice(0, 50) };
    else {
      const [min = "", max = ""] = raw.split("~");
      const valid = (v: string) => (type === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(v) : /^-?\d+$/.test(v));
      const f = { kind: "range" as const, min: valid(min) ? min : undefined, max: valid(max) ? max : undefined };
      if (isFilterActive(f)) filters[spec.id] = f;
    }
  }
  return { sort, filters };
}

export function writeTableParams(p: URLSearchParams, sort: SortState, filters: Filters) {
  for (const key of [...p.keys()]) if (key === "ord" || key.startsWith("f.")) p.delete(key);
  if (sort) p.set("ord", `${sort.id}.${sort.dir}`);
  for (const [id, f] of Object.entries(filters)) {
    if (!isFilterActive(f)) continue;
    if (f.kind === "text") p.set(`f.${id}`, f.q.trim());
    else if (f.kind === "values") p.set(`f.${id}`, f.values.join("|"));
    else p.set(`f.${id}`, `${f.min ?? ""}~${f.max ?? ""}`);
  }
}
