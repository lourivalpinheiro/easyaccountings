import type { Metadata } from "next";
import { getPublishedCompany } from "@/lib/public-company";
import { IncomeStatementReport } from "@/reports/income-statement";

export const metadata: Metadata = { title: "DRE" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/dre">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  return <IncomeStatementReport company={company} params={await searchParams} />;
}
