/** Conteúdo inicial de cada seção de um plano novo: títulos, blocos de dados e gráficos sugeridos (tudo editável). */
import { DEFAULT_CHART } from "@/lib/plan/calc";
import type { BlockKind, ChartSpec, DocNode, PlanSection } from "@/lib/plan/types";
import type { FlowType } from "@/lib/cash-flow-types";

const h2 = (text: string): DocNode => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const p = (text: string): DocNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const bullets = (items: string[]): DocNode => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const block = (kind: BlockKind, type: FlowType = "saida", limit = 8): DocNode => ({ type: "planBlock", attrs: { kind, type, limit } });
const chart = (spec: Partial<ChartSpec>): DocNode => ({ type: "planChart", attrs: { spec: { ...DEFAULT_CHART, ...spec } } });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });

export const SECTION_TEMPLATES: Record<PlanSection, DocNode> = {
  diagnostico: doc(
    h2("Visão geral"),
    block("indicadores"),
    chart({ title: "Entradas, saídas, cartão e economias por mês", source: "fluxo-diagnostico", chartType: "barras" }),
    h2("Para onde vai o dinheiro"),
    block("categorias", "saida", 8),
    chart({ title: "Saídas por categoria", source: "categorias", chartType: "rosca", types: ["saida"], period: "diagnostico" }),
    h2("Aplicações financeiras"),
    block("aplicacoes"),
    h2("Análise"),
    p("Descreva os pontos fortes, os problemas encontrados e as prioridades para o próximo período."),
  ),
  planejamento: doc(
    h2("Objetivos"),
    p("Descreva o que se pretende alcançar e por quê."),
    block("metas"),
    chart({ title: "Metas: valor atual x objetivo", source: "metas", chartType: "barras-horizontais" }),
    h2("Estratégia"),
    p("Como as metas serão alcançadas: cortes de gastos, aumento de receitas, onde aplicar os recursos."),
    h2("Plano de ação"),
    bullets(["Ação, responsável e prazo", "Ação, responsável e prazo"]),
  ),
  orcamentos: doc(
    p("Valores previstos para o ano, por tipo de movimentação e categoria do fluxo de caixa."),
    block("orcamento"),
    chart({ title: "Saídas: orçado x realizado por mês", source: "orcado-realizado-mensal", chartType: "barras", types: ["saida"] }),
    h2("Premissas do orçamento"),
    p("Explique os critérios usados para definir os valores."),
  ),
  controle: doc(
    block("controle"),
    chart({ title: "Saídas: orçado x realizado por categoria", source: "orcado-realizado-categorias", chartType: "barras-horizontais", types: ["saida"] }),
    chart({ title: "Saldo de caixa no fim de cada mês", source: "saldo-mensal", chartType: "linhas" }),
    h2("Comentários do período"),
    p("Justifique os desvios e registre as decisões tomadas."),
  ),
  cenarios: doc(
    p("Projeções do caixa e das aplicações a partir do orçamento (ou da média do diagnóstico) sob diferentes premissas econômicas."),
    block("cenarios"),
    chart({ title: "Patrimônio projetado (caixa + aplicações)", source: "cenarios", chartType: "linhas", metric: "total" }),
    h2("Conclusões"),
    p("Qual cenário é mais provável e o que fazer em cada um."),
  ),
};

export const DEFAULT_SCENARIOS = [
  { name: "Pessimista", color: "#dc2626", revenueGrowth: -5, expenseGrowth: 3, inflation: 6, investmentReturn: 9 },
  { name: "Base", color: "#2563eb", revenueGrowth: 0, expenseGrowth: 0, inflation: 4.5, investmentReturn: 10.5 },
  { name: "Otimista", color: "#16a34a", revenueGrowth: 5, expenseGrowth: -2, inflation: 3.5, investmentReturn: 12 },
];
