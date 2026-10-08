import type { Metadata } from "next";
import { getPublishedCompany, requirePublicSection } from "@/lib/public-company";
import { BudgetReport } from "@/reports/budget";

export const metadata: Metadata = { title: "Orçado x Realizado" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/orcamento">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  requirePublicSection(company, "orcamento");
  return <BudgetReport company={company} params={await searchParams} />;
}
