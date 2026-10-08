import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { closingBatches, closingSettings } from "@/db/schema";
import { getChart, getMovements } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { readPeriod } from "@/lib/period";
import { ClosingClient } from "./closing-client";

export const metadata: Metadata = { title: "Zeramento" };

export default async function ClosingPage({ searchParams }: PageProps<"/parametros/zeramento">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const period = readPeriod(await searchParams);

  const [chart, movements, [settings], batches] = await Promise.all([
    getChart(company.id),
    getMovements(company.id, { from: period.from, to: period.to }),
    db.select().from(closingSettings).where(eq(closingSettings.companyId, company.id)),
    db.select().from(closingBatches).where(eq(closingBatches.companyId, company.id)).orderBy(desc(closingBatches.createdAt)),
  ]);

  const preview = chart
    .filter((a) => a.analytic && (a.group === "despesa" || a.group === "receita"))
    .map((a) => {
      const m = movements.get(a.id);
      return { id: a.id, classification: a.classification, name: a.name, group: a.group!, balance: m ? m.debit - m.credit : 0 };
    })
    .filter((a) => a.balance !== 0);

  const pick = (group: string) =>
    chart
      .filter((a) => a.group === group)
      .map(({ id, reducedCode, classification, name, analytic }) => ({ id, reducedCode, classification, name, analytic }));

  return (
    <>
      <PageHeader
        title="Zeramento"
        description="Encerra as contas de resultado com lançamentos contrários, transfere o saldo para a conta de apuração e, dela, para o Patrimônio Líquido."
      />
      <ClosingClient
        period={period}
        settings={{
          resultAccountId: settings?.resultAccountId ?? null,
          profitAccountId: settings?.profitAccountId ?? null,
          lossAccountId: settings?.lossAccountId ?? null,
        }}
        apuracaoAccounts={pick("apuracao")}
        equityAccounts={pick("patrimonio_liquido")}
        preview={preview}
        batches={batches.map((b) => ({
          id: b.id,
          startDate: b.startDate,
          endDate: b.endDate,
          netResult: Math.round(Number(b.netResult) * 100),
          createdAt: b.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
