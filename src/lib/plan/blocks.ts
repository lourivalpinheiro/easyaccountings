/**
 * Conteúdo dos blocos de dados do plano em formato neutro (cartões, tabela e observações),
 * desenhado igual no editor e no PDF.
 */
import { formatDate, formatMoney } from "@/lib/accounting";
import { FLOW_TYPE_LABELS, FLOW_TYPES, type FlowType } from "@/lib/cash-flow-types";
import { INVESTMENT_KIND_LABELS } from "@/lib/investment-types";
import {
  budgetRows,
  controlAlerts,
  controlRows,
  diagnosisIndicators,
  elapsedMonths,
  goalStatus,
  MONTH_SHORT,
  monthLabel,
  pct,
  PRIORITY_LABELS,
  projectScenario,
  STATUS_LABELS,
  topCategories,
  type ControlStatus,
} from "@/lib/plan/calc";
import type { BlockKind, PlanDataset, PlanInputs } from "@/lib/plan/types";

export type Tone = "positive" | "negative" | "warning" | "muted" | undefined;
export type Cell = { text: string; tone?: Tone; bold?: boolean };
export type BlockModel = {
  title: string;
  cards?: { label: string; value: string; hint?: string; tone?: Tone }[];
  table?: {
    columns: { label: string; align?: "left" | "right" | "center"; width?: number }[];
    rows: { cells: Cell[]; bold?: boolean; shaded?: boolean }[];
    small?: boolean;
  };
  notes?: { text: string; tone?: Tone }[];
  empty?: string;
};

export type BlockOptions = { type: FlowType; limit: number };

const money = (c: number) => formatMoney(c);
const signedMoney = (c: number): Cell => ({ text: `${c < 0 ? "-" : ""}${formatMoney(Math.abs(c))}`, tone: c < 0 ? "negative" : undefined });
const statusTone: Record<ControlStatus, Tone> = { ok: "positive", atencao: "warning", estourado: "negative" };

export function blockModel(
  kind: BlockKind,
  opts: BlockOptions,
  ds: PlanDataset,
  inputs: Pick<PlanInputs, "budget" | "goals" | "scenarios">,
): BlockModel {
  switch (kind) {
    case "indicadores": {
      const d = diagnosisIndicators(ds);
      const ratio = (v: number | null) => (v === null ? "—" : pct(v));
      return {
        title: `Indicadores de ${formatDate(ds.diagnosis.from)} a ${formatDate(ds.diagnosis.to)}`,
        cards: [
          { label: "Entradas", value: money(d.totals.entrada), hint: `média de ${money(d.avgMonthly.entrada)}/mês` },
          { label: "Saídas", value: money(d.totals.saida), hint: `média de ${money(d.avgMonthly.saida)}/mês` },
          { label: "Cartão de crédito", value: money(d.totals.cartao_credito), hint: `média de ${money(d.avgMonthly.cartao_credito)}/mês` },
          { label: "Economias", value: money(d.totals.economia), hint: `média de ${money(d.avgMonthly.economia)}/mês` },
          { label: "Aplicações financeiras", value: money(d.investmentsBalance), hint: `saldo em ${formatDate(ds.diagnosis.to)}` },
          { label: "Resultado (entradas - despesas)", value: signedMoney(d.result).text, tone: d.result < 0 ? "negative" : "positive" },
        ],
        table: {
          columns: [{ label: "Indicador", width: 3 }, { label: "Valor", align: "right", width: 1 }, { label: "Referência", width: 2 }],
          rows: [
            { cells: [{ text: "Taxa de poupança (economias ÷ entradas)" }, { text: ratio(d.savingsRate) }, { text: "Ideal: 10% ou mais", tone: "muted" }] },
            { cells: [{ text: "Comprometimento com cartão (cartão ÷ entradas)" }, { text: ratio(d.cardShare) }, { text: "Ideal: até 30%", tone: "muted" }] },
            { cells: [{ text: "Despesas ÷ entradas" }, { text: ratio(d.expenseRatio) }, { text: "Abaixo de 100% sobra dinheiro", tone: "muted" }] },
            {
              cells: [
                { text: "Reserva em meses (aplicações ÷ despesa média mensal)" },
                { text: d.reserveMonths === null ? "—" : d.reserveMonths.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) },
                { text: "Ideal: 6 meses ou mais", tone: "muted" },
              ],
            },
            { cells: [{ text: "Saldo de caixa no fim do período" }, signedMoney(d.cashBalance), { text: "" }] },
          ],
        },
      };
    }
    case "categorias": {
      const rows = ds.diagnosis.categories;
      const top = topCategories(rows, opts.type, opts.limit);
      return {
        title: `${FLOW_TYPE_LABELS[opts.type].plural} por categoria (diagnóstico)`,
        empty: top.rows.length === 0 ? "Nenhuma movimentação desse tipo no período do diagnóstico." : undefined,
        table: {
          columns: [{ label: "Categoria" }, { label: "Valor", align: "right" }, { label: "% do total", align: "right" }],
          rows: [
            ...top.rows.map((r) => ({ cells: [{ text: r.category }, { text: money(r.cents) }, { text: pct(r.share) }] })),
            { bold: true, shaded: true, cells: [{ text: "Total" }, { text: money(top.total) }, { text: "100%" }] },
          ],
        },
      };
    }
    case "aplicacoes": {
      const total = ds.investments.reduce((s, i) => s + i.balance, 0);
      return {
        title: "Aplicações financeiras",
        empty: ds.investments.length === 0 ? "Nenhuma aplicação cadastrada em Financeiro › Aplicações financeiras." : undefined,
        table: {
          columns: [{ label: "Aplicação" }, { label: "Tipo" }, { label: "Saldo", align: "right" }, { label: "% da carteira", align: "right" }],
          rows: [
            ...ds.investments.map((i) => ({
              cells: [{ text: i.name }, { text: INVESTMENT_KIND_LABELS[i.kind] }, { text: money(i.balance) }, { text: total ? pct(i.balance / total) : "—" }],
            })),
            { bold: true, shaded: true, cells: [{ text: "Total" }, { text: "" }, { text: money(total) }, { text: "100%" }] },
          ],
        },
      };
    }
    case "metas": {
      return {
        title: "Metas financeiras",
        empty: inputs.goals.length === 0 ? "Nenhuma meta cadastrada. Cadastre as metas nos dados da seção Planejamento." : undefined,
        table: {
          columns: [
            { label: "Meta", width: 2 },
            { label: "Prioridade" },
            { label: "Prazo" },
            { label: "Objetivo", align: "right" },
            { label: "Atual", align: "right" },
            { label: "Progresso", align: "right" },
            { label: "Guardar por mês", align: "right" },
          ],
          rows: inputs.goals.map((g) => {
            const s = goalStatus(g, ds);
            return {
              cells: [
                { text: g.name },
                { text: PRIORITY_LABELS[g.priority] ?? "—" },
                { text: formatDate(g.deadline), tone: s.late ? "negative" : undefined },
                { text: money(g.targetCents) },
                { text: money(s.current) },
                { text: pct(s.progress), tone: s.done ? "positive" : undefined },
                { text: s.done ? "Atingida" : money(s.monthly), tone: s.done ? "positive" : undefined },
              ],
            };
          }),
        },
      };
    }
    case "orcamento": {
      const rows = budgetRows(inputs.budget);
      const totals = FLOW_TYPES.map((t) => {
        const r = rows.filter((x) => x.type === t);
        return { t, months: MONTH_SHORT.map((_, i) => r.reduce((s, x) => s + x.months[i], 0)), total: r.reduce((s, x) => s + x.total, 0) };
      }).filter((x) => x.total > 0);
      return {
        title: `Orçamento ${ds.year}`,
        empty: rows.length === 0 ? "Nenhum valor orçado. Preencha o orçamento nos dados da seção Orçamentos." : undefined,
        table: {
          small: true,
          columns: [{ label: "Categoria", width: 2.2 }, ...MONTH_SHORT.map((m) => ({ label: m, align: "right" as const })), { label: "Total", align: "right", width: 1.3 }],
          rows: totals.flatMap((tt) => [
            {
              bold: true,
              shaded: true,
              cells: [{ text: FLOW_TYPE_LABELS[tt.t].plural }, ...tt.months.map((v) => ({ text: v ? compactMoney(v) : "-" })), { text: compactMoney(tt.total) }],
            },
            ...rows
              .filter((r) => r.type === tt.t)
              .map((r) => ({ cells: [{ text: r.category }, ...r.months.map((v) => ({ text: v ? compactMoney(v) : "-" })), { text: compactMoney(r.total) }] })),
          ]),
        },
        notes: rows.length > 0 ? [{ text: "Valores em reais, sem centavos.", tone: "muted" }] : undefined,
      };
    }
    case "orcado-realizado": {
      const months = Math.max(1, elapsedMonths(ds));
      const rows = controlRows(inputs.budget, ds, months).filter((r) => r.type === opts.type);
      return {
        title: `${FLOW_TYPE_LABELS[opts.type].plural}: orçado x realizado até ${MONTH_SHORT[months - 1]}/${ds.year}`,
        empty: rows.length === 0 ? "Sem valores orçados ou realizados para esse tipo." : undefined,
        table: {
          columns: [
            { label: "Categoria", width: 2 },
            { label: "Orçado", align: "right" },
            { label: "Realizado", align: "right" },
            { label: "Diferença", align: "right" },
            { label: "%", align: "right", width: 0.6 },
          ],
          rows: rows.map((r) => ({
            cells: [{ text: r.category }, { text: money(r.budget) }, { text: money(r.actual) }, signedMoney(r.diff), { text: r.pct === null ? "—" : pct(r.pct), tone: statusTone[r.status] }],
          })),
        },
      };
    }
    case "controle": {
      const months = elapsedMonths(ds);
      if (months === 0) {
        return { title: "Controle", empty: `O ano de ${ds.year} ainda não começou; o acompanhamento aparece a partir de janeiro.` };
      }
      const rows = controlRows(inputs.budget, ds, months);
      const alerts = controlAlerts(inputs, ds);
      return {
        title: `Acompanhamento até ${MONTH_SHORT[months - 1]}/${ds.year}`,
        cards: (["ok", "atencao", "estourado"] as ControlStatus[]).map((s) => ({
          label: STATUS_LABELS[s],
          value: String(rows.filter((r) => r.status === s && (r.budget > 0 || r.actual > 0)).length),
          hint: "categorias",
          tone: statusTone[s],
        })),
        table: {
          columns: [
            { label: "Tipo" },
            { label: "Categoria", width: 1.3 },
            { label: "Orçado", align: "right" },
            { label: "Realizado", align: "right" },
            { label: "Diferença", align: "right" },
            { label: "Situação", width: 1.2 },
          ],
          rows: rows.map((r) => ({
            cells: [
              { text: FLOW_TYPE_LABELS[r.type].singular },
              { text: r.category },
              { text: money(r.budget) },
              { text: money(r.actual) },
              signedMoney(r.diff),
              { text: STATUS_LABELS[r.status], tone: statusTone[r.status] },
            ],
          })),
        },
        notes:
          alerts.length > 0
            ? alerts.map((a) => ({ text: a.text, tone: a.level === "estourado" ? ("negative" as Tone) : ("warning" as Tone) }))
            : [{ text: "Nenhum alerta no período.", tone: "positive" }],
      };
    }
    case "cenarios": {
      const proj = inputs.scenarios.map((s) => ({ s, p: projectScenario(s, inputs.budget, ds) }));
      return {
        title: "Premissas e resultado dos cenários",
        empty: proj.length === 0 ? "Nenhum cenário cadastrado. Cadastre os cenários nos dados da seção Cenários." : undefined,
        table: {
          columns: [
            { label: "Cenário", width: 1.3 },
            { label: "Receitas % a.a.", align: "right" },
            { label: "Despesas % a.a.", align: "right" },
            { label: "Inflação % a.a.", align: "right" },
            { label: "Rendim. % a.a.", align: "right" },
            { label: "Fim", align: "right" },
            { label: "Caixa", align: "right" },
            { label: "Aplicações", align: "right" },
            { label: "Patrimônio", align: "right" },
          ],
          rows: proj.map(({ s, p }) => {
            const last = p[p.length - 1];
            const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
            return {
              cells: [
                { text: s.name, bold: true },
                { text: n(s.revenueGrowth) },
                { text: n(s.expenseGrowth) },
                { text: n(s.inflation) },
                { text: n(s.investmentReturn) },
                { text: last ? monthLabel(last.month) : "—" },
                signedMoney(last?.cash ?? 0),
                { text: money(last?.invested ?? 0) },
                signedMoney(last?.total ?? 0),
              ],
            };
          }),
        },
        notes: [
          {
            text: `Partida em ${formatDate(ds.start.date)}: caixa de ${formatMoney(ds.start.cashBalance)} e aplicações de ${formatMoney(ds.start.investmentsBalance)}. Valores mensais vêm do orçamento (ou da média do diagnóstico quando o tipo não foi orçado).`,
            tone: "muted",
          },
        ],
      };
    }
  }
}

function compactMoney(cents: number) {
  return Math.round(cents / 100).toLocaleString("pt-BR");
}
