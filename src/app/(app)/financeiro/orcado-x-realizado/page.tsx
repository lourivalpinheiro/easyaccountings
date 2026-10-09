import type { Metadata } from "next";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { BudgetReport } from "@/reports/budget";

export const metadata: Metadata = { title: "Orçado x Realizado" };

export default async function Page({ searchParams }: PageProps<"/financeiro/orcado-x-realizado">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <BudgetReport company={company} params={await searchParams} />;
}
