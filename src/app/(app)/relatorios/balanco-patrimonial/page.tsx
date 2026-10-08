import type { Metadata } from "next";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { BalanceSheetReport } from "@/reports/balance-sheet";

export const metadata: Metadata = { title: "Balanço Patrimonial" };

export default async function Page({ searchParams }: PageProps<"/relatorios/balanco-patrimonial">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <BalanceSheetReport company={company} params={await searchParams} />;
}
