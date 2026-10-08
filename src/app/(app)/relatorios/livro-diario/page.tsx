import type { Metadata } from "next";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { JournalBookReport } from "@/reports/journal-book";

export const metadata: Metadata = { title: "Livro Diário" };

export default async function Page({ searchParams }: PageProps<"/relatorios/livro-diario">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <JournalBookReport company={company} params={await searchParams} />;
}
