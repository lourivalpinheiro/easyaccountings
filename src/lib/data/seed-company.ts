import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { accountGroupSettings, accounts, closingSettings, dreCategories, historyCodes } from "@/db/schema";
import { DEFAULT_GROUP_SETTINGS } from "@/lib/accounting";

const DEFAULT_DRE = [
  "RECEITA BRUTA",
  "DEDUÇÕES DA RECEITA",
  "CUSTOS",
  "DESPESAS FIXAS",
  "DESPESAS VARIÁVEIS",
  "OUTRAS RECEITAS E DESPESAS",
];

// [classificação, nome, categoria DRE (índice em DEFAULT_DRE)]
const DEFAULT_CHART: [string, string, number?][] = [
  ["1", "ATIVO"],
  ["1.1", "ATIVO CIRCULANTE"],
  ["1.1.1", "DISPONIBILIDADES"],
  ["1.1.1.01", "Caixa geral"],
  ["1.1.1.02", "Bancos conta movimento"],
  ["1.1.2", "CLIENTES"],
  ["1.1.2.01", "Clientes diversos"],
  ["1.2", "ATIVO NÃO CIRCULANTE"],
  ["1.2.1", "IMOBILIZADO"],
  ["1.2.1.01", "Móveis e utensílios"],
  ["1.2.2", "INVESTIMENTOS"],
  ["1.2.2.01", "Aplicações financeiras"],
  ["2", "PASSIVO"],
  ["2.1", "PASSIVO CIRCULANTE"],
  ["2.1.1", "FORNECEDORES"],
  ["2.1.1.01", "Fornecedores diversos"],
  ["2.1.2", "OBRIGAÇÕES TRABALHISTAS"],
  ["2.1.2.01", "Salários a pagar"],
  ["2.2", "PASSIVO NÃO CIRCULANTE"],
  ["2.2.1", "EMPRÉSTIMOS E FINANCIAMENTOS"],
  ["2.2.1.01", "Empréstimos e financiamentos"],
  ["2.3", "PATRIMÔNIO LÍQUIDO"],
  ["2.3.1", "CAPITAL SOCIAL"],
  ["2.3.1.01", "Capital social integralizado"],
  ["2.3.2", "LUCROS OU PREJUÍZOS ACUMULADOS"],
  ["2.3.2.01", "Lucros acumulados"],
  ["2.3.2.02", "Prejuízos acumulados"],
  ["3", "DESPESAS"],
  ["3.1", "DESPESAS OPERACIONAIS"],
  ["3.1.1", "DESPESAS ADMINISTRATIVAS"],
  ["3.1.1.01", "Alimentações e refeições", 3],
  ["3.1.1.02", "Aluguéis", 3],
  ["3.1.1.03", "Energia elétrica", 3],
  ["3.1.1.04", "Salários", 3],
  ["3.1.2", "DESPESAS FINANCEIRAS"],
  ["3.1.2.01", "Juros e tarifas bancárias", 5],
  ["4", "RECEITAS"],
  ["4.1", "RECEITAS OPERACIONAIS"],
  ["4.1.1", "RECEITA DE VENDAS"],
  ["4.1.1.01", "Vendas de mercadorias", 0],
  ["4.1.1.02", "Prestação de serviços", 0],
  ["4.1.2", "RECEITAS FINANCEIRAS"],
  ["4.1.2.01", "Rendimentos de aplicações financeiras", 5],
  ["5", "APURAÇÃO"],
  ["5.1", "APURAÇÃO DO RESULTADO"],
  ["5.1.1", "RESULTADO DO EXERCÍCIO"],
  ["5.1.1.01", "Apuração do resultado do exercício"],
];

/** Parâmetros, categorias de DRE e plano de contas padrão de uma nova empresa. */
export async function seedCompany(tx: Tx, companyId: string) {
  await tx
    .insert(accountGroupSettings)
    .values(DEFAULT_GROUP_SETTINGS.map((s) => ({ ...s, companyId })));

  const categories = await tx
    .insert(dreCategories)
    .values(DEFAULT_DRE.map((name, i) => ({ companyId, name, position: i + 1 })))
    .returning({ id: dreCategories.id });

  const inserted = await tx
    .insert(accounts)
    .values(
      DEFAULT_CHART.map(([classification, name, dre], i) => ({
        companyId,
        reducedCode: i + 1,
        classification,
        name,
        dreCategoryId: dre === undefined ? null : categories[dre].id,
      })),
    )
    .returning({ id: accounts.id, classification: accounts.classification });

  const byClass = (c: string) => inserted.find((a) => a.classification === c)?.id ?? null;
  await tx.insert(closingSettings).values({
    companyId,
    resultAccountId: byClass("5.1.1.01"),
    profitAccountId: byClass("2.3.2.01"),
    lossAccountId: byClass("2.3.2.02"),
  });
}

/**
 * Replica os parâmetros de outra empresa (natureza das contas, categorias de DRE, plano de contas,
 * históricos padrão e configuração de zeramento) para uma empresa recém-criada, no lugar do padrão.
 * Não copia lançamentos nem nenhum outro dado movimentado.
 */
export async function cloneCompanyParams(tx: Tx, sourceCompanyId: string, companyId: string) {
  const [groupSettings, categories, sourceAccounts, histories, closing] = await Promise.all([
    tx.select().from(accountGroupSettings).where(eq(accountGroupSettings.companyId, sourceCompanyId)),
    tx.select().from(dreCategories).where(eq(dreCategories.companyId, sourceCompanyId)),
    tx.select().from(accounts).where(eq(accounts.companyId, sourceCompanyId)).orderBy(accounts.classification),
    tx.select().from(historyCodes).where(eq(historyCodes.companyId, sourceCompanyId)),
    tx.select().from(closingSettings).where(eq(closingSettings.companyId, sourceCompanyId)).then((r) => r[0] ?? null),
  ]);

  if (groupSettings.length > 0) {
    await tx.insert(accountGroupSettings).values(groupSettings.map((s) => ({ group: s.group, nature: s.nature, prefix: s.prefix, companyId })));
  }

  const categoryIdMap = new Map<string, string>();
  if (categories.length > 0) {
    const insertedCategories = await tx
      .insert(dreCategories)
      .values(categories.map((c) => ({ companyId, name: c.name, position: c.position })))
      .returning({ id: dreCategories.id });
    categories.forEach((c, i) => categoryIdMap.set(c.id, insertedCategories[i].id));
  }

  const accountIdMap = new Map<string, string>();
  if (sourceAccounts.length > 0) {
    const insertedAccounts = await tx
      .insert(accounts)
      .values(
        sourceAccounts.map((a, i) => ({
          companyId,
          reducedCode: i + 1,
          classification: a.classification,
          name: a.name,
          dreCategoryId: a.dreCategoryId ? (categoryIdMap.get(a.dreCategoryId) ?? null) : null,
        })),
      )
      .returning({ id: accounts.id });
    sourceAccounts.forEach((a, i) => accountIdMap.set(a.id, insertedAccounts[i].id));
  }

  if (histories.length > 0) {
    await tx.insert(historyCodes).values(histories.map((h) => ({ companyId, code: h.code, description: h.description })));
  }

  await tx.insert(closingSettings).values({
    companyId,
    resultAccountId: closing?.resultAccountId ? (accountIdMap.get(closing.resultAccountId) ?? null) : null,
    profitAccountId: closing?.profitAccountId ? (accountIdMap.get(closing.profitAccountId) ?? null) : null,
    lossAccountId: closing?.lossAccountId ? (accountIdMap.get(closing.lossAccountId) ?? null) : null,
  });
}
