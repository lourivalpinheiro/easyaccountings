/** Evolução mensal de uma aplicação (função pura, usada no cliente). Valores em centavos. */

export type InvestmentMovement = { date: string; kind: "aporte" | "resgate"; cents: number; description: string };
export type InvestmentValuation = { date: string; cents: number };

export type InvestmentPoint = {
  month: string;
  /** Saldo líquido no fim do mês: último saldo informado + aportes - resgates feitos depois dele. */
  balance: number;
  /** Capital aplicado: saldo inicial + aportes - resgates acumulados até o fim do mês. */
  capital: number;
  /** Ganho de capital acumulado (saldo - capital aplicado). */
  gain: number;
};

const monthEnd = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

const nextMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

const signed = (m: InvestmentMovement) => (m.kind === "aporte" ? m.cents : -m.cents);

/** Saldo numa data com a mesma regra do servidor (último saldo informado + movimentações posteriores). */
export function balanceAt(date: string, movements: InvestmentMovement[], valuations: InvestmentValuation[]) {
  const last = valuations.filter((v) => v.date <= date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const after = movements.filter((m) => m.date <= date && (!last || m.date > last.date)).reduce((s, m) => s + signed(m), 0);
  return (last?.cents ?? 0) + after;
}

/**
 * Saldo inicial: quando o primeiro saldo informado vem antes de qualquer aporte, ele é o capital que já estava
 * aplicado (não é rendimento). Os saldos informados depois dele é que revelam o ganho de capital.
 */
export function openingCapital(movements: InvestmentMovement[], valuations: InvestmentValuation[]) {
  const first = [...valuations].sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  if (!first) return { date: null as string | null, cents: 0 };
  const before = movements.filter((m) => m.date <= first.date).reduce((s, m) => s + signed(m), 0);
  return before === 0 ? { date: first.date, cents: first.cents } : { date: null, cents: 0 };
}

export function investmentSeries(movements: InvestmentMovement[], valuations: InvestmentValuation[], today: string): InvestmentPoint[] {
  const dates = [...movements.map((m) => m.date), ...valuations.map((v) => v.date)].sort();
  if (dates.length === 0) return [];
  const opening = openingCapital(movements, valuations);
  const out: InvestmentPoint[] = [];
  const last = today.slice(0, 7);
  for (let ym = dates[0].slice(0, 7); ym <= last; ym = nextMonth(ym)) {
    const end = ym === last ? today : monthEnd(ym);
    const contributed = movements.filter((m) => m.date <= end).reduce((s, m) => s + signed(m), 0);
    const capital = contributed + (opening.date && opening.date <= end ? opening.cents : 0);
    const balance = balanceAt(end, movements, valuations);
    out.push({ month: ym, balance, capital, gain: balance - capital });
  }
  return out;
}

/** Posição de uma aplicação numa data: saldo, capital aplicado e ganho de capital. */
export function positionAt(date: string, movements: InvestmentMovement[], valuations: InvestmentValuation[]) {
  const opening = openingCapital(movements, valuations);
  const contributed = movements.filter((m) => m.date <= date).reduce((s, m) => s + signed(m), 0);
  const capital = contributed + (opening.date && opening.date <= date ? opening.cents : 0);
  const balance = balanceAt(date, movements, valuations);
  return { balance, capital, gain: balance - capital };
}

/** Primeira data com movimentação ou saldo informado: o dia em que a aplicação começou a ser acompanhada. */
export function firstEventDate(movements: InvestmentMovement[], valuations: InvestmentValuation[]): string | null {
  const dates = [...movements.map((m) => m.date), ...valuations.map((v) => v.date)].sort();
  return dates[0] ?? null;
}

const daysBetween = (from: string, to: string) => {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
};

/**
 * Taxa de rendimento anualizada (CAGR): composta a partir do ganho acumulado desde o dia da primeira
 * movimentação ou saldo informado até `today`. `null` quando não há dados suficientes para calcular
 * (sem histórico, menos de um dia corrido ou capital aplicado zerado/negativo).
 */
export function annualizedReturn(movements: InvestmentMovement[], valuations: InvestmentValuation[], today: string): number | null {
  const first = firstEventDate(movements, valuations);
  if (!first) return null;
  const days = daysBetween(first, today);
  if (days <= 0) return null;
  const { capital, gain } = positionAt(today, movements, valuations);
  if (capital <= 0) return null;
  const totalReturn = gain / capital;
  if (totalReturn <= -1) return -1;
  return (1 + totalReturn) ** (365 / days) - 1;
}

/** Fins de mês (AAAA-MM-DD) entre duas datas; o último ponto é a própria data final. */
export function monthEnds(from: string, to: string) {
  const out: string[] = [];
  for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ym = nextMonth(ym)) {
    const end = monthEnd(ym);
    out.push(end < to ? end : to);
  }
  return out;
}
