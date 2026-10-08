import type { Metadata } from "next";
import { getPublishedCompany } from "@/lib/public-company";
import { LedgerBookReport } from "@/reports/ledger-book";

export const metadata: Metadata = { title: "Livro Razão" };

export default async function Page({ params, searchParams }: PageProps<"/publico/[token]/livro-razao">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  return <LedgerBookReport company={company} params={await searchParams} />;
}
