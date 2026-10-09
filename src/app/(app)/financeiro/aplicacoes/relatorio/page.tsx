import type { Metadata } from "next";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { InvestmentsReport } from "@/reports/investments";

export const metadata: Metadata = { title: "Relatório de aplicações" };

export default async function Page({ searchParams }: PageProps<"/financeiro/aplicacoes/relatorio">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <InvestmentsReport company={company} params={await searchParams} />;
}
