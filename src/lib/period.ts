/** Período padrão (início do ano até hoje) e leitura segura de datas da URL. */
export function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function yearStartIso() {
  return `${todayIso().slice(0, 4)}-01-01`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function readPeriod(params: Record<string, string | string[] | undefined>) {
  const from = typeof params.de === "string" && ISO.test(params.de) ? params.de : yearStartIso();
  const to = typeof params.ate === "string" && ISO.test(params.ate) ? params.ate : todayIso();
  return { from, to };
}
