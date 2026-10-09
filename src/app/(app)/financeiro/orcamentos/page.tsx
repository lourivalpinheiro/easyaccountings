import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import { getChart } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { BudgetsClient } from "./budgets-client";

export const metadata: Metadata = { title: "Orçamentos" };

export default async function BudgetsPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const [chart, rows] = await Promise.all([
    getChart(company.id),
    db.query.budgets.findMany({
      where: eq(budgets.companyId, company.id),
      orderBy: desc(budgets.startDate),
      with: { items: true },
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Orçamentos"
        description="Defina período, valor total e o valor orçado de cada conta. Compare com o realizado em Relatórios > Orçado x Realizado."
      />
      <BudgetsClient
        accounts={chart.map(({ id, reducedCode, classification, name, analytic }) => ({
          id,
          reducedCode,
          classification,
          name,
          analytic,
        }))}
        budgets={rows.map((b) => ({
          id: b.id,
          name: b.name,
          startDate: b.startDate,
          endDate: b.endDate,
          totalCents: toCents(b.totalAmount),
          items: b.items.map((i) => ({ accountId: i.accountId, cents: toCents(i.amount) })),
        }))}
      />
    </>
  );
}
