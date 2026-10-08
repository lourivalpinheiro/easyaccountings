import type { Metadata } from "next";
import { getPublishedCompany } from "@/lib/public-company";
import { CashFlowReport } from "@/reports/cash-flow";

export const metadata: Metadata = { title: "Fluxo de caixa" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/fluxo-de-caixa">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  return <CashFlowReport company={company} params={await searchParams} />;
}
