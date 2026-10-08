import type { Metadata } from "next";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { TrialBalanceReport } from "@/reports/trial-balance";

export const metadata: Metadata = { title: "Balancete de Verificação" };

export default async function Page({ searchParams }: PageProps<"/relatorios/balancete">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <TrialBalanceReport company={company} params={await searchParams} />;
}
