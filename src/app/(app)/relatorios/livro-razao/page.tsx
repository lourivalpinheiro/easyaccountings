import type { Metadata } from "next";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { LedgerBookReport } from "@/reports/ledger-book";

export const metadata: Metadata = { title: "Livro Razão" };

export default async function Page({ searchParams }: PageProps<"/relatorios/livro-razao">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <LedgerBookReport company={company} params={await searchParams} />;
}
