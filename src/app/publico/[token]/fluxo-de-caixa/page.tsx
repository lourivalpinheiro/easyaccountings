import type { Metadata } from "next";
import { PublicAttachments } from "@/components/public-attachments";
import { getPublicCashFlowAttachments } from "@/lib/data/attachments";
import { getPublishedCompany, requirePublicSection } from "@/lib/public-company";
import { CashFlowReport } from "@/reports/cash-flow";

export const metadata: Metadata = { title: "Fluxo de caixa" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/fluxo-de-caixa">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  requirePublicSection(company, "fluxo-de-caixa");
  const attachments = await getPublicCashFlowAttachments(company.id);
  return (
    <>
      <CashFlowReport company={company} params={await searchParams} />
      <PublicAttachments token={token} attachments={attachments} />
    </>
  );
}
