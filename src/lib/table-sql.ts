import "server-only";
import { asc, desc, gte, ilike, inArray, lte, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { isFilterActive, type ColumnSpec, type Filters, type SortState } from "@/lib/table-controls";

type Expr = AnyColumn | SQL;

/**
 * Converte os filtros de coluna (lidos da URL) em condições SQL.
 * `exprs` mapeia o id da coluna para a coluna/expressão do banco; colunas `money` são comparadas em reais.
 */
export function filtersToSql(specs: ColumnSpec[], filters: Filters, exprs: Record<string, Expr>): SQL[] {
  const out: SQL[] = [];
  for (const spec of specs) {
    const f = filters[spec.id];
    if (!f || !exprs[spec.id] || !isFilterActive(f)) continue;
    const expr = sql`${exprs[spec.id]}`;
    if (f.kind === "text") {
      out.push(ilike(expr, `%${f.q.trim().replace(/[\\%_]/g, "\\$&")}%`));
    } else if (f.kind === "values") {
      out.push(inArray(expr, f.values));
    } else {
      const conv = (v: string) => (spec.type === "money" ? (Number(v) / 100).toFixed(2) : spec.type === "number" ? Number(v) : v);
      if (f.min) out.push(gte(expr, conv(f.min)));
      if (f.max) out.push(lte(expr, conv(f.max)));
    }
  }
  return out;
}

/** Ordenação pedida na URL, ou `fallback` quando não houver. */
export function sortToSql(sort: SortState, exprs: Record<string, Expr>, fallback: SQL[]): SQL[] {
  const expr = sort && exprs[sort.id];
  if (!sort || !expr) return fallback;
  // Vazios por último nas duas direções, como na ordenação feita no cliente.
  return [sort.dir === "asc" ? sql`${asc(expr)} nulls last` : sql`${desc(expr)} nulls last`, ...fallback];
}
