import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { historyCodes } from "@/db/schema";
import { getPageContext } from "@/lib/page-context";
import { HistoryCodesClient } from "./history-codes-client";

export const metadata: Metadata = { title: "Históricos padrão" };

export default async function HistoryCodesPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const rows = await db
    .select({ id: historyCodes.id, code: historyCodes.code, description: historyCodes.description })
    .from(historyCodes)
    .where(eq(historyCodes.companyId, company.id))
    .orderBy(asc(historyCodes.code));
  return (
    <>
      <PageHeader
        title="Históricos padrão"
        description="Códigos de histórico usados na tela de lançamentos para preencher a descrição."
      />
      <HistoryCodesClient rows={rows} />
    </>
  );
}
