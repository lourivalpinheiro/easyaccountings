/** Tipos de aplicação financeira, compartilhados entre servidor e cliente. */

export const INVESTMENT_KINDS = [
  "poupanca",
  "cdb",
  "lci_lca",
  "tesouro",
  "fundo",
  "acoes",
  "previdencia",
  "cripto",
  "outro",
] as const;
export type InvestmentKind = (typeof INVESTMENT_KINDS)[number];

export const INVESTMENT_KIND_LABELS: Record<InvestmentKind, string> = {
  poupanca: "Poupança",
  cdb: "CDB",
  lci_lca: "LCI / LCA",
  tesouro: "Tesouro Direto",
  fundo: "Fundo de investimento",
  acoes: "Ações / ETF",
  previdencia: "Previdência",
  cripto: "Criptoativos",
  outro: "Outro",
};
