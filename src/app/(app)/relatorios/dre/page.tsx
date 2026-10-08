import type { Metadata } from "next";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { IncomeStatementReport } from "@/reports/income-statement";

export const metadata: Metadata = { title: "DRE" };

export default async function Page({ searchParams }: PageProps<"/relatorios/dre">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <IncomeStatementReport company={company} params={await searchParams} />;
}
