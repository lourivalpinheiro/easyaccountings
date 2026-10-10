import type { ColumnSpec } from "@/lib/table-controls";

/** Colunas da lista de contas a pagar/receber; ordenação e filtros são aplicados na consulta (paginação no servidor). */
export const PROVISION_COLUMNS: ColumnSpec[] = [
  { id: "dueDate", label: "Vencimento", type: "date" },
  { id: "description", label: "Descrição" },
  { id: "category", label: "Categoria", type: "select" },
  {
    id: "type",
    label: "Tipo",
    type: "select",
    options: [
      { value: "pagar", label: "A pagar" },
      { value: "receber", label: "A receber" },
    ],
  },
  { id: "amount", label: "Valor", type: "money" },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "pendente", label: "Pendente" },
      { value: "baixado", label: "Baixado" },
    ],
  },
];
