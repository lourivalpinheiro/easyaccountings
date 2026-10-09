import { FLOW_TYPE_LABELS, FLOW_TYPES } from "@/lib/cash-flow-types";
import type { ColumnSpec } from "@/lib/table-controls";

/** Colunas da lista de movimentações; ordenação e filtros são aplicados na consulta (paginação no servidor). */
export const CASH_FLOW_COLUMNS: ColumnSpec[] = [
  { id: "date", label: "Data", type: "date" },
  { id: "description", label: "Descrição" },
  { id: "category", label: "Categoria", type: "select" },
  {
    id: "type",
    label: "Tipo",
    type: "select",
    options: FLOW_TYPES.map((t) => ({ value: t, label: FLOW_TYPE_LABELS[t].singular })),
  },
  { id: "amount", label: "Valor", type: "money" },
];
