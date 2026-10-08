import "server-only";

export type OfxTransaction = {
  fitId: string | null;
  date: string;
  cents: number;
  description: string;
};

export type OfxStatement = {
  bankName: string | null;
  accountId: string | null;
  transactions: OfxTransaction[];
};

/** Lê o valor de uma tag SGML/XML dentro de um trecho: `<TAG>valor` (SGML não fecha) ou `<TAG>valor</TAG>` (XML). */
function tagValue(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, "i"));
  const v = m ? m[1].trim() : null;
  return v || null;
}

/** AAAAMMDDhhmmss[-3:BRT] ou AAAAMMDD → AAAA-MM-DD. */
function ofxDateToIso(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Valor monetário do OFX: o padrão usa "." como separador decimal, mas bancos fora do padrão
 * às vezes mandam vírgula decimal, separador de milhar, ou sinal negativo no final ("150,00-").
 */
function parseOfxAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, "");
  let negative = false;
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // O último separador é o decimal; o outro é separador de milhar.
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}

/** Detecta a codificação pelo cabeçalho (ENCODING/CHARSET do OFX 1.x, ou <?xml ... encoding="...">). */
function detectEncoding(bytes: Uint8Array): string {
  // BOM UTF-8/UTF-16 tem prioridade sobre qualquer declaração de texto.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";

  // O cabeçalho é sempre ASCII puro, então uma leitura latin1 dos primeiros bytes é segura
  // só para achar as declarações de charset, independente da codificação real do resto do arquivo.
  const head = Buffer.from(bytes.slice(0, 1024)).toString("latin1");
  const xmlEncoding = head.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i)?.[1];
  if (xmlEncoding) return normalizeEncodingName(xmlEncoding);
  const charset = head.match(/CHARSET:\s*([A-Za-z0-9-]+)/i)?.[1];
  if (charset) return normalizeEncodingName(charset);
  const encoding = head.match(/ENCODING:\s*([A-Za-z0-9-]+)/i)?.[1];
  if (encoding && !/^USASCII$/i.test(encoding)) return normalizeEncodingName(encoding);
  return "utf-8";
}

function normalizeEncodingName(name: string) {
  const n = name.trim().toUpperCase();
  if (n === "1252" || n === "CP1252" || n === "WINDOWS-1252") return "windows-1252";
  if (n === "8859-1" || n === "ISO-8859-1" || n === "LATIN1") return "iso-8859-1";
  if (n === "UTF-8" || n === "UTF8") return "utf-8";
  return name;
}

/** Decodifica os bytes do arquivo detectando a codificação declarada; cai para UTF-8 se não reconhecer. */
function decode(bytes: Uint8Array): string {
  const encoding = detectEncoding(bytes);
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

/**
 * Parser próprio de OFX (1.x SGML, tags sem fechamento, e 2.x XML) — extrai só o que a
 * conciliação precisa (transações do extrato). Não depende de nenhuma lib de OFX/XML.
 * Aceita texto diferentes de codificação (UTF-8, Windows-1252/Latin1, UTF-16) e pequenas
 * variações de formatação entre bancos (vírgula decimal, quebras de linha, maiúsc./minúsc.).
 */
export function parseOfx(input: string | ArrayBuffer | Uint8Array): OfxStatement {
  const text =
    typeof input === "string" ? input : decode(input instanceof Uint8Array ? input : new Uint8Array(input));

  const firstTrn = text.search(/<STMTTRN>/i);
  const header = firstTrn === -1 ? text : text.slice(0, firstTrn);
  const bankName = tagValue(header, "ORG");
  const accountId = tagValue(header, "ACCTID");

  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const transactions: OfxTransaction[] = [];
  for (const block of blocks) {
    const amountRaw = tagValue(block, "TRNAMT");
    const dateRaw = tagValue(block, "DTPOSTED");
    if (!amountRaw || !dateRaw) continue;
    const date = ofxDateToIso(dateRaw);
    if (!date) continue;
    const cents = parseOfxAmount(amountRaw);
    if (cents === null || cents === 0) continue;
    const description = tagValue(block, "MEMO") || tagValue(block, "NAME") || "Transação importada";
    transactions.push({ fitId: tagValue(block, "FITID"), date, cents, description });
  }
  return { bankName, accountId, transactions };
}

/** Chave usada pelos Knots: descrição normalizada (maiúsculas, espaços colapsados). */
export function normalizePattern(description: string) {
  return description.trim().toUpperCase().replace(/\s+/g, " ");
}
