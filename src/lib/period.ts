/** Período padrão (início do ano até hoje) e leitura segura de datas da URL. */
/** Data de hoje no fuso de Brasília, independente do fuso do servidor ou do navegador. */
export function todayIso() {
  // en-CA formata como AAAA-MM-DD.
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function yearStartIso() {
  return `${todayIso().slice(0, 4)}-01-01`;
}

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function readPeriod(params: Record<string, string | string[] | undefined>) {
  const from = typeof params.de === "string" && ISO.test(params.de) ? params.de : yearStartIso();
  const to = typeof params.ate === "string" && ISO.test(params.ate) ? params.ate : todayIso();
  return { from, to };
}

/** Primeiro e último dia do mês da data (AAAA-MM-DD). */
export function monthRangeIso(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Período do painel: o informado na URL ou, por padrão, o mês atual completo. */
export function readMonthPeriod(params: Record<string, string | string[] | undefined>) {
  const month = monthRangeIso(todayIso());
  const from = typeof params.de === "string" && ISO.test(params.de) ? params.de : month.from;
  const to = typeof params.ate === "string" && ISO.test(params.ate) ? params.ate : month.to;
  return from <= to ? { from, to } : month;
}
