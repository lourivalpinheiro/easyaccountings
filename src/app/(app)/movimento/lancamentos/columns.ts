import type { ColumnSpec } from "@/lib/table-controls";

/** Colunas da lista de lançamentos; ordenação e filtros são aplicados na consulta (paginação no servidor). */
export const ENTRY_COLUMNS: ColumnSpec[] = [
  { id: "number", label: "Nº", type: "number" },
  { id: "date", label: "Data", type: "date" },
  { id: "description", label: "Descrição" },
  { id: "debit", label: "Débito", sortable: false },
  { id: "credit", label: "Crédito", sortable: false },
  { id: "amount", label: "Valor", type: "money" },
];
