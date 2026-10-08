import type { Metadata } from "next";
import { getPublishedCompany, requirePublicSection } from "@/lib/public-company";
import { TrialBalanceReport } from "@/reports/trial-balance";

export const metadata: Metadata = { title: "Balancete de Verificação" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/balancete">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  requirePublicSection(company, "balancete");
  return <TrialBalanceReport company={company} params={await searchParams} />;
}
