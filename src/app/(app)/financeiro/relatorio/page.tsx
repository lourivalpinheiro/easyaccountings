import type { Metadata } from "next";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { CashFlowReport } from "@/reports/cash-flow";

export const metadata: Metadata = { title: "Relatório de fluxo de caixa" };

export default async function Page({ searchParams }: PageProps<"/financeiro/relatorio">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <CashFlowReport company={company} params={await searchParams} />;
}
