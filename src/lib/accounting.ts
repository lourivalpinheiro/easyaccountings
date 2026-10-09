/** Regras contábeis puras, compartilhadas entre servidor e cliente. */

export type AccountGroup =
  | "ativo"
  | "passivo"
  | "patrimonio_liquido"
  | "despesa"
  | "receita"
  | "apuracao";
export type Nature = "D" | "C";

export const MAX_LEVEL = 4;

export const GROUP_LABELS: Record<AccountGroup, string> = {
  ativo: "Ativo",
  passivo: "Passivo",
  patrimonio_liquido: "Patrimônio Líquido",
  despesa: "Contas de resultado - Despesas",
  receita: "Contas de resultado - Receitas",
  apuracao: "Contas de apuração",
};

export const GROUP_ORDER: AccountGroup[] = [
  "ativo",
  "passivo",
  "patrimonio_liquido",
  "despesa",
  "receita",
  "apuracao",
];

export const DEFAULT_GROUP_SETTINGS: { group: AccountGroup; nature: Nature | null; prefix: string }[] = [
  { group: "ativo", nature: "D", prefix: "1" },
  { group: "passivo", nature: "C", prefix: "2" },
  { group: "patrimonio_liquido", nature: "C", prefix: "2.3" },
  { group: "despesa", nature: "D", prefix: "3" },
  { group: "receita", nature: "C", prefix: "4" },
  { group: "apuracao", nature: null, prefix: "5" },
];

export type GroupSetting = { group: AccountGroup; nature: Nature | null; prefix: string };

const CLASSIFICATION_RE = /^\d+(\.\d+){0,3}$/;

export function isValidClassification(value: string) {
  return CLASSIFICATION_RE.test(value);
}

export function levelOf(classification: string) {
  return classification.split(".").length;
}

/** Apenas contas de 4º grau são analíticas e recebem lançamentos. */
export function isAnalytic(classification: string) {
  return levelOf(classification) === MAX_LEVEL;
}

export function parentOf(classification: string) {
  const parts = classification.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : null;
}

export function isDescendantOrSelf(classification: string, ancestor: string) {
  return classification === ancestor || classification.startsWith(`${ancestor}.`);
}

/** Grupo da conta pelo maior prefixo de numeração configurado que a contém. */
export function groupOf(classification: string, settings: GroupSetting[]): AccountGroup | null {
  let best: GroupSetting | null = null;
  for (const s of settings) {
    if (isDescendantOrSelf(classification, s.prefix) && (!best || s.prefix.length > best.prefix.length)) {
      best = s;
    }
  }
  return best?.group ?? null;
}

/** Ordena classificações numericamente segmento a segmento (1.10 depois de 1.9). */
export function compareClassification(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** Sugere a próxima classificação filha de `parent` com base nas irmãs existentes. */
export function suggestChildClassification(parent: string | null, existing: string[]) {
  const depth = parent ? levelOf(parent) + 1 : 1;
  const siblings = existing.filter((c) => levelOf(c) === depth && (parent ? parentOf(c) === parent : true));
  const max = siblings.reduce((m, c) => Math.max(m, Number(c.split(".").pop())), 0);
  const next = String(max + 1);
  const segment = depth === MAX_LEVEL ? next.padStart(2, "0") : next;
  return parent ? `${parent}.${segment}` : segment;
}

// ---------- Valores monetários (sempre em centavos inteiros) ----------

export function toCents(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  return Math.round(Number(value) * 100);
}

export function centsToDecimal(cents: number) {
  return (cents / 100).toFixed(2);
}

const moneyFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(cents: number) {
  return moneyFormatter.format(cents / 100);
}

/** Saldo com indicação D (devedor) ou C (credor). `cents` = débitos - créditos. */
export function formatBalance(cents: number) {
  if (cents === 0) return "0,00";
  return `${formatMoney(Math.abs(cents))} ${cents > 0 ? "D" : "C"}`;
}

/** Valor para relatórios: zero aparece como "-". */
export function formatReportMoney(cents: number) {
  return cents === 0 ? "-" : formatMoney(cents);
}

/** Saldo D/C para relatórios: zero aparece como "-". */
export function formatReportBalance(cents: number) {
  return cents === 0 ? "-" : formatBalance(cents);
}

/** Data e hora no fuso de Brasília, independente do fuso do servidor ou do navegador. */
export function formatDateTimeBrasilia(value: string | Date) {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Data e hora atuais no fuso de Brasília, independente do fuso do servidor. */
export function formatNowBrasilia() {
  return formatDateTimeBrasilia(new Date());
}

/** Converte texto digitado em pt-BR ("1.234,56") para centavos. */
export function parseMoneyInput(text: string) {
  const clean = text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatCnpj(cnpj: string) {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function isValidCnpj(value: string) {
  const d = value.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function formatCpf(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function isValidCpf(value: string) {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const digit = (len: number) => {
    const sum = d
      .slice(0, len)
      .split("")
      .reduce((acc, n, i) => acc + Number(n) * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

// ---------- Pessoa física (CPF) ou jurídica (CNPJ) ----------

export type PersonType = "PF" | "PJ" | "INF";

export const PERSON_LABELS: Record<PersonType, { type: string; name: string; document: string; displayName: string }> = {
  PF: { type: "Pessoa Física", name: "Nome completo", document: "CPF", displayName: "Apelido" },
  PJ: { type: "Pessoa Jurídica", name: "Razão Social", document: "CNPJ", displayName: "Nome fantasia" },
  INF: { type: "Informal", name: "Nome", document: "", displayName: "" },
};

/** Empresas informais não têm documento: retorna string vazia. */
export function formatDocument(personType: PersonType, document: string | null) {
  if (personType === "INF" || !document) return "";
  return personType === "PF" ? formatCpf(document) : formatCnpj(document);
}

export function isValidDocument(personType: PersonType, document: string) {
  if (personType === "INF") return true;
  return personType === "PF" ? isValidCpf(document) : isValidCnpj(document);
}

export type EntryFormula = "1x1" | "1xN" | "Nx1" | "NxN";

export const FORMULA_LABELS: Record<EntryFormula, string> = {
  "1x1": "Um débito para um crédito",
  "1xN": "Um débito para vários créditos",
  Nx1: "Um crédito para vários débitos",
  NxN: "Vários débitos para vários créditos",
};

export function formulaOf(debits: number, credits: number): EntryFormula {
  if (debits <= 1 && credits <= 1) return "1x1";
  if (debits === 1) return "1xN";
  if (credits === 1) return "Nx1";
  return "NxN";
}
