import type { Metadata } from "next";
import { getPublishedCompany, requirePublicSection } from "@/lib/public-company";
import { BalanceSheetReport } from "@/reports/balance-sheet";

export const metadata: Metadata = { title: "Balanço Patrimonial" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/balanco-patrimonial">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  requirePublicSection(company, "balanco-patrimonial");
  return <BalanceSheetReport company={company} params={await searchParams} />;
}
