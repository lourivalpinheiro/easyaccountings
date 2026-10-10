import type { Metadata } from "next";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { ProvisionamentoReport } from "@/reports/provisionamento";

export const metadata: Metadata = { title: "Relatório de provisionamento" };

export default async function Page({ searchParams }: PageProps<"/financeiro/provisionamento/relatorio">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <ProvisionamentoReport company={company} params={await searchParams} />;
}
