/** Tipos do planejamento financeiro, compartilhados entre servidor, cliente e PDF. */
import type { FlowType } from "@/lib/cash-flow-types";
import type { InvestmentKind } from "@/lib/investment-types";

export const PLAN_SECTIONS = ["diagnostico", "planejamento", "orcamentos", "cenarios"] as const;
export type PlanSection = (typeof PLAN_SECTIONS)[number];

export const PLAN_SECTION_LABELS: Record<PlanSection, { title: string; description: string }> = {
  diagnostico: { title: "Diagnóstico", description: "Situação financeira atual: entradas, saídas, cartão de crédito, economias e aplicações." },
  planejamento: { title: "Planejamento", description: "Metas financeiras, prazos e quanto guardar por mês para alcançá-las." },
  orcamentos: { title: "Orçamentos", description: "Valores orçados por categoria do fluxo de caixa, comparados com o realizado." },
  cenarios: { title: "Cenários", description: "Projeção do fluxo de caixa sob diferentes premissas econômicas." },
};

export const isPlanSection = (v: unknown): v is PlanSection =>
  typeof v === "string" && (PLAN_SECTIONS as readonly string[]).includes(v);

/** Documento do editor (JSON do Tiptap). */
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

/** Diferencia um texto em branco (editor vazio) de um que já tem conteúdo digitado. */
export function sectionHasContent(doc: DocNode | undefined): boolean {
  if (!doc?.content || doc.content.length === 0) return false;
  if (doc.content.length > 1) return true;
  const only = doc.content[0];
  return only.type !== "paragraph" || Boolean(only.content && only.content.length > 0);
}

export type ByType = Record<FlowType, number>;

export type BudgetItem = { type: FlowType; category: string; month: number; cents: number };

export type Goal = {
  id: string;
  name: string;
  targetCents: number;
  initialCents: number;
  deadline: string;
  priority: number;
  annualReturn: number;
  investmentId: string | null;
  notes: string | null;
};

export type ScenarioEvent = { month: string; description: string; cents: number };

export type Scenario = {
  id: string;
  name: string;
  color: string;
  revenueGrowth: number;
  expenseGrowth: number;
  inflation: number;
  investmentReturn: number;
  horizonMonths: number;
  events: ScenarioEvent[];
};

/** Números do sistema usados pelo plano (todos em centavos). Guardados também em cada versão salva. */
export type PlanDataset = {
  generatedAt: string;
  today: string;
  year: number;
  diagnosis: {
    from: string;
    to: string;
    monthsCount: number;
    totals: ByType;
    months: { month: string; byType: ByType }[];
    categories: { type: FlowType; category: string; cents: number }[];
    cashBalance: number;
    investmentsBalance: number;
  };
  /** Realizado no ano do plano, mês a mês (1 a 12). */
  actual: {
    openingBalance: number;
    months: { month: number; byType: ByType; endBalance: number }[];
    categories: { type: FlowType; category: string; month: number; cents: number }[];
  };
  /** Saldos de partida das projeções: caixa e aplicações no início do ano do plano (ou hoje, se o ano ainda não começou). */
  start: { date: string; cashBalance: number; investmentsBalance: number };
  investments: { id: string; name: string; kind: InvestmentKind; balance: number }[];
  categories: string[];
};

/** Dados editáveis do plano (entram nas versões salvas). */
export type PlanInputs = {
  title: string;
  diagnosisFrom: string;
  diagnosisTo: string;
  content: Partial<Record<PlanSection, DocNode>>;
  budget: BudgetItem[];
  goals: Goal[];
  scenarios: Scenario[];
};

export type PlanSnapshot = PlanInputs & { dataset: PlanDataset };

// ---------- Gráficos montados pelo usuário ----------

export const CHART_TYPES = ["barras", "barras-horizontais", "barras-empilhadas", "linhas", "area", "pizza", "rosca"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  barras: "Barras",
  "barras-horizontais": "Barras horizontais",
  "barras-empilhadas": "Barras empilhadas",
  linhas: "Linhas",
  area: "Área",
  pizza: "Pizza",
  rosca: "Rosca",
};

export const CHART_SOURCES = [
  "fluxo-ano",
  "fluxo-diagnostico",
  "categorias",
  "saldo-mensal",
  "orcado-realizado-mensal",
  "orcado-realizado-categorias",
  "cenarios",
  "metas",
  "aplicacoes",
  "manual",
] as const;
export type ChartSource = (typeof CHART_SOURCES)[number];
export const CHART_SOURCE_LABELS: Record<ChartSource, string> = {
  "fluxo-ano": "Fluxo de caixa mensal do ano (realizado)",
  "fluxo-diagnostico": "Fluxo de caixa mensal do diagnóstico",
  categorias: "Valores por categoria",
  "saldo-mensal": "Saldo de caixa no fim de cada mês",
  "orcado-realizado-mensal": "Orçado x realizado por mês",
  "orcado-realizado-categorias": "Orçado x realizado por categoria",
  cenarios: "Projeção dos cenários",
  metas: "Metas: atual x objetivo",
  aplicacoes: "Saldo das aplicações",
  manual: "Dados digitados",
};

export type ChartSpec = {
  title: string;
  chartType: ChartType;
  source: ChartSource;
  /** Tipos de movimentação exibidos (fontes de fluxo) ou o tipo analisado (categorias / orçado x realizado). */
  types: FlowType[];
  /** Período das categorias. */
  period: "ano" | "diagnostico";
  /** Métrica dos cenários. */
  metric: "caixa" | "aplicado" | "total";
  /** Quantidade máxima de categorias (o resto vira "Outras"). */
  limit: number;
  manual: { labels: string[]; series: { name: string; values: number[] }[] };
};

export type ChartData = { labels: string[]; series: { name: string; color: string; values: number[] }[]; money: boolean };

// ---------- Blocos de dados ----------

export const BLOCK_KINDS = [
  "indicadores",
  "categorias",
  "aplicacoes",
  "metas",
  "orcamento",
  "orcado-realizado",
  "controle",
  "cenarios",
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const BLOCK_LABELS: Record<BlockKind, string> = {
  indicadores: "Indicadores do diagnóstico",
  categorias: "Maiores categorias",
  aplicacoes: "Aplicações financeiras",
  metas: "Metas",
  orcamento: "Orçamento anual",
  "orcado-realizado": "Orçado x realizado",
  controle: "Controle e alertas",
  cenarios: "Resumo dos cenários",
};
