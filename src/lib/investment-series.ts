/** Evolução mensal de uma aplicação (função pura, usada no cliente). Valores em centavos. */

export type InvestmentMovement = { date: string; kind: "aporte" | "resgate"; cents: number; description: string };
export type InvestmentValuation = { date: string; cents: number };

export type InvestmentPoint = {
  month: string;
  /** Saldo no fim do mês: último saldo informado + aportes - resgates feitos depois dele. */
  balance: number;
  /** Aportes - resgates acumulados até o fim do mês. */
  invested: number;
  /** Rendimento acumulado (saldo - aportes líquidos). */
  yieldTotal: number;
  /** Rendimento do mês (variação do rendimento acumulado). */
  yieldMonth: number;
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

export function investmentSeries(movements: InvestmentMovement[], valuations: InvestmentValuation[], today: string): InvestmentPoint[] {
  const dates = [...movements.map((m) => m.date), ...valuations.map((v) => v.date)].sort();
  if (dates.length === 0) return [];
  const out: InvestmentPoint[] = [];
  let prevYield = 0;
  const last = today.slice(0, 7);
  for (let ym = dates[0].slice(0, 7); ym <= last; ym = nextMonth(ym)) {
    const end = ym === last ? today : monthEnd(ym);
    const invested = movements.filter((m) => m.date <= end).reduce((s, m) => s + signed(m), 0);
    const balance = balanceAt(end, movements, valuations);
    const yieldTotal = balance - invested;
    out.push({ month: ym, balance, invested, yieldTotal, yieldMonth: yieldTotal - prevYield });
    prevYield = yieldTotal;
  }
  return out;
}
