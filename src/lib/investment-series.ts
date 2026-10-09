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
