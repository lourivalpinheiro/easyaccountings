/** Cálculos do planejamento financeiro (funções puras: rodam no cliente, no servidor e no PDF). */
import { FLOW_TYPE_LABELS, FLOW_TYPES, type FlowType } from "@/lib/cash-flow-types";
import type {
  BudgetItem,
  ByType,
  ChartData,
  ChartSpec,
  Goal,
  PlanDataset,
  PlanInputs,
  Scenario,
} from "@/lib/plan/types";

export const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Paleta das séries dos gráficos (legível em fundo claro e escuro). */
export const PALETTE = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#ca8a04", "#db2777", "#4b5563", "#65a30d"];

export const TYPE_COLORS: Record<FlowType, string> = {
  entrada: "#16a34a",
  saida: "#dc2626",
  economia: "#0284c7",
  cartao_credito: "#7c3aed",
};

export const emptyByType = (): ByType => ({ entrada: 0, saida: 0, economia: 0, cartao_credito: 0 });

/** Despesas = saídas + cartão de crédito (economia não é despesa: o dinheiro continua seu). */
export const expensesOf = (t: ByType) => t.saida + t.cartao_credito;

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]}/${String(y).slice(2)}`;
};

export const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

// ---------- Diagnóstico ----------

export function diagnosisIndicators(ds: PlanDataset) {
  const t = ds.diagnosis.totals;
  const months = Math.max(1, ds.diagnosis.monthsCount);
  const expenses = expensesOf(t);
  const avgExpenses = expenses / months;
  return {
    totals: t,
    // Mesmo conceito do painel: receitas - despesas (economias não são despesa).
    result: t.entrada - expenses,
    avgMonthly: Object.fromEntries(FLOW_TYPES.map((k) => [k, Math.round(t[k] / months)])) as ByType,
    savingsRate: ratio(t.economia, t.entrada),
    cardShare: ratio(t.cartao_credito, t.entrada),
    expenseRatio: ratio(expenses, t.entrada),
    reserveMonths: avgExpenses > 0 ? ds.diagnosis.investmentsBalance / avgExpenses : null,
    cashBalance: ds.diagnosis.cashBalance,
    investmentsBalance: ds.diagnosis.investmentsBalance,
  };
}

export function topCategories(
  rows: { type: FlowType; category: string; cents: number }[],
  type: FlowType,
  limit: number,
) {
  const byCat = new Map<string, number>();
  for (const r of rows) if (r.type === type) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.cents);
  const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) top.push(["Outras", rest]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  return { rows: top.map(([category, cents]) => ({ category, cents, share: total ? cents / total : 0 })), total };
}

// ---------- Metas ----------

function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** Valor atual da meta: saldo da aplicação ligada ou o valor inicial informado. */
export function goalCurrent(goal: Goal, ds: PlanDataset) {
  const inv = goal.investmentId ? ds.investments.find((i) => i.id === goal.investmentId) : null;
  return inv ? inv.balance : goal.initialCents;
}

/** Aporte mensal necessário (valor futuro com juros compostos mensais). */
export function monthlyContribution(target: number, current: number, months: number, annualReturnPct: number) {
  const remaining = target - current;
  if (remaining <= 0) return 0;
  if (months <= 0) return remaining;
  const r = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  if (r === 0) return Math.ceil(remaining / months);
  const growth = Math.pow(1 + r, months);
  return Math.max(0, Math.ceil(((target - current * growth) * r) / (growth - 1)));
}

export function goalStatus(goal: Goal, ds: PlanDataset) {
  const current = goalCurrent(goal, ds);
  const monthsLeft = Math.max(0, monthsBetween(ds.today, goal.deadline));
  const progress = goal.targetCents > 0 ? Math.min(1, current / goal.targetCents) : 1;
  return {
    current,
    monthsLeft,
    monthly: monthlyContribution(goal.targetCents, current, monthsLeft, goal.annualReturn),
    progress,
    done: current >= goal.targetCents,
    late: current < goal.targetCents && goal.deadline < ds.today,
  };
}

export const PRIORITY_LABELS: Record<number, string> = { 1: "Alta", 2: "Média", 3: "Baixa" };

// ---------- Orçamento ----------

export type BudgetRow = { type: FlowType; category: string; months: number[]; total: number };

export function budgetRows(budget: BudgetItem[]): BudgetRow[] {
  const map = new Map<string, BudgetRow>();
  for (const b of budget) {
    const key = `${b.type}|${b.category}`;
    const row = map.get(key) ?? { type: b.type, category: b.category, months: Array(12).fill(0), total: 0 };
    row.months[b.month - 1] += b.cents;
    row.total += b.cents;
    map.set(key, row);
  }
  return [...map.values()].sort(
    (a, b) => FLOW_TYPES.indexOf(a.type) - FLOW_TYPES.indexOf(b.type) || a.category.localeCompare(b.category, "pt-BR"),
  );
}

export function budgetByType(budget: BudgetItem[], month?: number): ByType {
  const t = emptyByType();
  for (const b of budget) if (month === undefined || b.month === month) t[b.type] += b.cents;
  return t;
}

/** Meses do ano do plano já encerrados ou em andamento (para comparar orçado x realizado). */
export function elapsedMonths(ds: PlanDataset) {
  const [ty, tm] = ds.today.split("-").map(Number);
  if (ty < ds.year) return 0;
  if (ty > ds.year) return 12;
  return tm;
}

export type ControlStatus = "ok" | "atencao" | "estourado";
export const STATUS_LABELS: Record<ControlStatus, string> = { ok: "Dentro do previsto", atencao: "Atenção", estourado: "Fora do previsto" };

/** Entradas e economias devem atingir o orçado; saídas e cartão não devem passar dele. */
export function statusOf(type: FlowType, budget: number, actual: number): ControlStatus {
  if (budget === 0) return actual === 0 ? "ok" : type === "entrada" || type === "economia" ? "ok" : "estourado";
  const pct = actual / budget;
  if (type === "entrada" || type === "economia") return pct >= 1 ? "ok" : pct >= 0.9 ? "atencao" : "estourado";
  return pct <= 1 ? "ok" : pct <= 1.1 ? "atencao" : "estourado";
}

export type ControlRow = {
  type: FlowType;
  category: string;
  budget: number;
  actual: number;
  diff: number;
  pct: number | null;
  status: ControlStatus;
};

/** Orçado x realizado acumulado até `upToMonth`, por tipo e categoria. */
export function controlRows(budget: BudgetItem[], ds: PlanDataset, upToMonth = elapsedMonths(ds)): ControlRow[] {
  const map = new Map<string, ControlRow>();
  const get = (type: FlowType, category: string) => {
    const key = `${type}|${category}`;
    const row = map.get(key) ?? { type, category, budget: 0, actual: 0, diff: 0, pct: null, status: "ok" as ControlStatus };
    map.set(key, row);
    return row;
  };
  for (const b of budget) if (b.month <= upToMonth) get(b.type, b.category).budget += b.cents;
  for (const a of ds.actual.categories) if (a.month <= upToMonth) get(a.type, a.category).actual += a.cents;
  return [...map.values()]
    .map((r) => ({ ...r, diff: r.actual - r.budget, pct: ratio(r.actual, r.budget), status: statusOf(r.type, r.budget, r.actual) }))
    .sort((a, b) => FLOW_TYPES.indexOf(a.type) - FLOW_TYPES.indexOf(b.type) || b.actual - a.actual);
}

export function controlAlerts(inputs: Pick<PlanInputs, "budget" | "goals">, ds: PlanDataset) {
  const alerts: { level: "atencao" | "estourado"; text: string }[] = [];
  const months = elapsedMonths(ds);
  const actual = emptyByType();
  for (const m of ds.actual.months) if (m.month <= months) for (const t of FLOW_TYPES) actual[t] += m.byType[t];
  const cardShare = ratio(actual.cartao_credito, actual.entrada);
  if (cardShare !== null && cardShare > 0.3) {
    alerts.push({ level: cardShare > 0.5 ? "estourado" : "atencao", text: `Cartão de crédito consome ${pct(cardShare)} das entradas do ano.` });
  }
  const savings = ratio(actual.economia, actual.entrada);
  if (savings !== null && savings < 0.1 && months > 0) {
    alerts.push({ level: "atencao", text: `Taxa de poupança de ${pct(savings)} no ano, abaixo de 10% das entradas.` });
  }
  const negative = ds.actual.months.filter((m) => m.month <= months && m.endBalance < 0);
  if (negative.length > 0) {
    alerts.push({
      level: "estourado",
      text: `Saldo de caixa negativo no fim de ${negative.map((m) => MONTH_SHORT[m.month - 1]).join(", ")}.`,
    });
  }
  for (const r of controlRows(inputs.budget, ds, months)) {
    if (r.status === "estourado" && r.budget > 0) {
      const what = r.type === "entrada" || r.type === "economia" ? "abaixo" : "acima";
      alerts.push({ level: "estourado", text: `${FLOW_TYPE_LABELS[r.type].singular} em "${r.category}" ${what} do orçado (${pct(r.pct ?? 0)}).` });
    }
  }
  for (const g of inputs.goals) {
    const s = goalStatus(g, ds);
    if (s.late) alerts.push({ level: "estourado", text: `Meta "${g.name}" passou do prazo sem atingir o valor.` });
  }
  return alerts;
}

export const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

// ---------- Cenários ----------

export type ProjectionMonth = {
  month: string;
  inflow: number;
  expenses: number;
  savings: number;
  events: number;
  cash: number;
  invested: number;
  total: number;
};

/** Valor-base mensal de cada tipo: orçamento do mês (quando houver) ou a média mensal do diagnóstico. */
function baseFor(type: FlowType, monthOfYear: number, budget: BudgetItem[], ds: PlanDataset) {
  const hasBudget = budget.some((b) => b.type === type);
  if (hasBudget) return budget.filter((b) => b.type === type && b.month === monthOfYear).reduce((s, b) => s + b.cents, 0);
  return ds.diagnosis.totals[type] / Math.max(1, ds.diagnosis.monthsCount);
}

export function projectScenario(s: Scenario, budget: BudgetItem[], ds: PlanDataset): ProjectionMonth[] {
  const rev = 1 + s.revenueGrowth / 100;
  const exp = (1 + s.inflation / 100) * (1 + s.expenseGrowth / 100);
  const ret = Math.pow(1 + s.investmentReturn / 100, 1 / 12);
  let cash = ds.start.cashBalance;
  let invested = ds.start.investmentsBalance;
  const out: ProjectionMonth[] = [];
  for (let i = 0; i < Math.max(1, s.horizonMonths); i++) {
    const year = ds.year + Math.floor(i / 12);
    const monthOfYear = (i % 12) + 1;
    const ym = `${year}-${String(monthOfYear).padStart(2, "0")}`;
    const years = i / 12;
    const inflow = Math.round(baseFor("entrada", monthOfYear, budget, ds) * Math.pow(rev, years));
    const expenses = Math.round(
      (baseFor("saida", monthOfYear, budget, ds) + baseFor("cartao_credito", monthOfYear, budget, ds)) * Math.pow(exp, years),
    );
    const savings = Math.round(baseFor("economia", monthOfYear, budget, ds));
    const events = s.events.filter((e) => e.month === ym).reduce((sum, e) => sum + e.cents, 0);
    cash += inflow - expenses - savings + events;
    invested = Math.round(invested * ret) + savings;
    out.push({ month: ym, inflow, expenses, savings, events, cash, invested, total: cash + invested });
  }
  return out;
}

// ---------- Dados dos gráficos ----------

export const DEFAULT_CHART: ChartSpec = {
  title: "",
  chartType: "barras",
  source: "fluxo-ano",
  types: ["entrada", "saida", "cartao_credito", "economia"],
  period: "ano",
  metric: "total",
  limit: 6,
  manual: { labels: ["A", "B", "C"], series: [{ name: "Série 1", values: [10, 20, 30] }] },
};

export function chartData(spec: ChartSpec, ds: PlanDataset, inputs: Pick<PlanInputs, "budget" | "goals" | "scenarios">): ChartData {
  const types = spec.types.length > 0 ? spec.types : ["entrada" as FlowType];
  const series = (name: string, values: number[], i: number, color?: string) => ({ name, values, color: color ?? PALETTE[i % PALETTE.length] });

  switch (spec.source) {
    case "fluxo-ano":
      return {
        labels: ds.actual.months.map((m) => MONTH_SHORT[m.month - 1]),
        series: types.map((t) => series(FLOW_TYPE_LABELS[t].plural, ds.actual.months.map((m) => m.byType[t]), 0, TYPE_COLORS[t])),
        money: true,
      };
    case "fluxo-diagnostico":
      return {
        labels: ds.diagnosis.months.map((m) => monthLabel(m.month)),
        series: types.map((t) => series(FLOW_TYPE_LABELS[t].plural, ds.diagnosis.months.map((m) => m.byType[t]), 0, TYPE_COLORS[t])),
        money: true,
      };
    case "categorias": {
      const rows = spec.period === "diagnostico" ? ds.diagnosis.categories : ds.actual.categories;
      const top = topCategories(rows, types[0], spec.limit);
      return {
        labels: top.rows.map((r) => r.category),
        series: [series(FLOW_TYPE_LABELS[types[0]].plural, top.rows.map((r) => r.cents), 0, TYPE_COLORS[types[0]])],
        money: true,
      };
    }
    case "saldo-mensal": {
      const months = elapsedMonths(ds);
      const shown = ds.actual.months.filter((m) => m.month <= Math.max(months, 1));
      return {
        labels: shown.map((m) => MONTH_SHORT[m.month - 1]),
        series: [series("Saldo de caixa", shown.map((m) => m.endBalance), 0)],
        money: true,
      };
    }
    case "orcado-realizado-mensal": {
      const t = types[0];
      return {
        labels: MONTH_SHORT,
        series: [
          series("Orçado", Array.from({ length: 12 }, (_, i) => budgetByType(inputs.budget, i + 1)[t]), 0, "#94a3b8"),
          series("Realizado", ds.actual.months.map((m) => m.byType[t]), 0, TYPE_COLORS[t]),
        ],
        money: true,
      };
    }
    case "orcado-realizado-categorias": {
      const rows = controlRows(inputs.budget, ds, 12).filter((r) => r.type === types[0]).slice(0, spec.limit);
      return {
        labels: rows.map((r) => r.category),
        series: [series("Orçado", rows.map((r) => r.budget), 0, "#94a3b8"), series("Realizado", rows.map((r) => r.actual), 0, TYPE_COLORS[types[0]])],
        money: true,
      };
    }
    case "cenarios": {
      const projections = inputs.scenarios.map((s) => ({ s, p: projectScenario(s, inputs.budget, ds) }));
      const longest = projections.reduce((m, x) => Math.max(m, x.p.length), 0);
      const labels = projections.find((x) => x.p.length === longest)?.p.map((m) => monthLabel(m.month)) ?? [];
      return {
        labels,
        series: projections.map(({ s, p }) => ({ name: s.name, color: s.color, values: p.map((m) => m[spec.metric === "aplicado" ? "invested" : spec.metric === "caixa" ? "cash" : "total"]) })),
        money: true,
      };
    }
    case "metas":
      return {
        labels: inputs.goals.map((g) => g.name),
        series: [
          series("Atual", inputs.goals.map((g) => goalCurrent(g, ds)), 1),
          series("Objetivo", inputs.goals.map((g) => g.targetCents), 0, "#94a3b8"),
        ],
        money: true,
      };
    case "aplicacoes":
      return {
        labels: ds.investments.map((i) => i.name),
        series: [series("Saldo", ds.investments.map((i) => i.balance), 0)],
        money: true,
      };
    case "manual":
      return {
        labels: spec.manual.labels,
        series: spec.manual.series.map((s, i) => series(s.name, s.values, i)),
        money: false,
      };
  }
}
