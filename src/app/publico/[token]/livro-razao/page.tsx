import type { Metadata } from "next";
import { getPublishedCompany, requirePublicSection } from "@/lib/public-company";
import { LedgerBookReport } from "@/reports/ledger-book";

export const metadata: Metadata = { title: "Livro Razão" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/livro-razao">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  requirePublicSection(company, "livro-razao");
  return <LedgerBookReport company={company} params={await searchParams} />;
}
