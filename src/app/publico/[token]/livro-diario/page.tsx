import type { Metadata } from "next";
import { PublicAttachments } from "@/components/public-attachments";
import { getPublicJournalAttachments } from "@/lib/data/attachments";
import { getPublishedCompany, requirePublicSection } from "@/lib/public-company";
import { JournalBookReport } from "@/reports/journal-book";

export const metadata: Metadata = { title: "Livro Diário" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/livro-diario">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  requirePublicSection(company, "livro-diario");
  const attachments = await getPublicJournalAttachments(company.id);
  return (
    <>
      <JournalBookReport company={company} params={await searchParams} />
      <PublicAttachments token={token} attachments={attachments} />
    </>
  );
}
