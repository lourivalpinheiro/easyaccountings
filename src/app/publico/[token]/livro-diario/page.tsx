import type { Metadata } from "next";
import { getPublishedCompany } from "@/lib/public-company";
import { JournalBookReport } from "@/reports/journal-book";

export const metadata: Metadata = { title: "Livro Diário" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/livro-diario">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  return <JournalBookReport company={company} params={await searchParams} />;
}
