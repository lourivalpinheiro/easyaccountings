/** Tipos e frequências do fluxo de caixa, compartilhados entre servidor e cliente. */

export const FLOW_TYPES = ["entrada", "saida", "economia", "cartao_credito"] as const;
export type FlowType = (typeof FLOW_TYPES)[number];

/** Apenas "entrada" soma ao caixa; saída, economia e cartão de crédito retiram dinheiro do caixa. */
export const FLOW_TYPE_LABELS: Record<FlowType, { singular: string; plural: string }> = {
  entrada: { singular: "Entrada", plural: "Entradas" },
  saida: { singular: "Saída", plural: "Saídas" },
  economia: { singular: "Economia", plural: "Economias" },
  cartao_credito: { singular: "Cartão de crédito", plural: "Cartão de crédito" },
};

export function isFlowType(value: unknown): value is FlowType {
  return typeof value === "string" && (FLOW_TYPES as readonly string[]).includes(value);
}

export function isInflow(type: FlowType) {
  return type === "entrada";
}

/** Valor com sinal (centavos): positivo para entrada, negativo para os demais tipos. */
export function signedCents(type: FlowType, cents: number) {
  return isInflow(type) ? cents : -cents;
}

export const FREQUENCIES = [
  "unica",
  "diaria",
  "semanal",
  "quinzenal",
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  unica: "Única (não repete)",
  diaria: "Diária",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const MAX_OCCURRENCES = 120;

const STEP: Record<Exclude<Frequency, "unica">, { days?: number; months?: number }> = {
  diaria: { days: 1 },
  semanal: { days: 7 },
  quinzenal: { days: 14 },
  mensal: { months: 1 },
  bimestral: { months: 2 },
  trimestral: { months: 3 },
  semestral: { months: 6 },
  anual: { months: 12 },
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Datas (AAAA-MM-DD) das ocorrências a partir de `start`. Em frequências mensais o dia é mantido;
 * quando o mês não tem esse dia (ex.: 31), usa o último dia do mês.
 */
export function occurrenceDates(start: string, frequency: Frequency, count: number) {
  if (frequency === "unica") return [start];
  const [y, m, d] = start.split("-").map(Number);
  const step = STEP[frequency];
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    if (step.days) {
      const dt = new Date(Date.UTC(y, m - 1, d + step.days * i));
      dates.push(`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`);
    } else {
      const total = m - 1 + step.months! * i;
      const year = y + Math.floor(total / 12);
      const month = (total % 12) + 1;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      dates.push(`${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`);
    }
  }
  return dates;
}
