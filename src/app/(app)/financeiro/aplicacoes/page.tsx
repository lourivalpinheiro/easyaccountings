import { desc, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { investmentValuations } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import { getInvestmentBalances } from "@/lib/data/investments";
import { getPageContext } from "@/lib/page-context";
import { todayIso } from "@/lib/period";
import { InvestmentsClient } from "./investments-client";

export const metadata: Metadata = { title: "Aplicações financeiras" };

export default async function InvestmentsPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const list = await getInvestmentBalances(company.id, todayIso());
  const valuations =
    list.length === 0
      ? []
      : await db
          .select()
          .from(investmentValuations)
          .where(inArray(investmentValuations.investmentId, list.map((i) => i.id)))
          .orderBy(desc(investmentValuations.date));

  return (
    <>
      <PageHeader
        title="Aplicações financeiras"
        description="Aportes entram no fluxo de caixa como Economia e resgates como Entrada; informe o saldo atualizado para incluir os rendimentos."
      />
      <InvestmentsClient
        investments={list}
        valuations={valuations.map((v) => ({ id: v.id, investmentId: v.investmentId, date: v.date, cents: toCents(v.balance) }))}
      />
    </>
  );
}
