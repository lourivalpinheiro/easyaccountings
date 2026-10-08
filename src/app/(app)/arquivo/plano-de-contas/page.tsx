import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { dreCategories } from "@/db/schema";
import { getChart } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { ChartClient } from "./chart-client";

export const metadata: Metadata = { title: "Plano de contas" };

export default async function ChartOfAccountsPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const [chart, categories] = await Promise.all([
    getChart(company.id),
    db
      .select({ id: dreCategories.id, name: dreCategories.name })
      .from(dreCategories)
      .where(eq(dreCategories.companyId, company.id))
      .orderBy(asc(dreCategories.position)),
  ]);
  return (
    <>
      <PageHeader
        title="Plano de contas"
        description="Contas sintéticas (até 3º grau) agrupam; contas analíticas (4º grau) recebem lançamentos."
      />
      <ChartClient chart={chart} categories={categories} />
    </>
  );
}
