import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { RemocaoClient } from "./remocao-client";

export const metadata: Metadata = { title: "Remoção de lançamentos" };

export default async function RemocaoPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return (
    <>
      <PageHeader
        title="Remoção de lançamentos"
        description="Exclui em massa lançamentos contábeis e/ou movimentações do fluxo de caixa, com filtro por período."
      />
      <RemocaoClient isAdmin={user.role === "admin"} />
    </>
  );
}
