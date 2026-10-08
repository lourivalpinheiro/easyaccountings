import "server-only";
import type { Tx } from "@/db";
import { accountGroupSettings, accounts, closingSettings, dreCategories } from "@/db/schema";
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
  ["2", "PASSIVO"],
  ["2.1", "PASSIVO CIRCULANTE"],
  ["2.1.1", "FORNECEDORES"],
  ["2.1.1.01", "Fornecedores diversos"],
  ["2.1.2", "OBRIGAÇÕES TRABALHISTAS"],
  ["2.1.2.01", "Salários a pagar"],
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
  ["4", "RECEITAS"],
  ["4.1", "RECEITAS OPERACIONAIS"],
  ["4.1.1", "RECEITA DE VENDAS"],
  ["4.1.1.01", "Vendas de mercadorias", 0],
  ["4.1.1.02", "Prestação de serviços", 0],
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
