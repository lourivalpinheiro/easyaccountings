import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { cashFlowEntries, investmentValuations } from "@/db/schema";
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
  const ids = list.map((i) => i.id);
  const [valuations, movements] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          db.select().from(investmentValuations).where(inArray(investmentValuations.investmentId, ids)).orderBy(desc(investmentValuations.date)),
          // Aportes (economia) e resgates (entrada) do fluxo de caixa ligados às aplicações.
          db
            .select({
              investmentId: cashFlowEntries.investmentId,
              date: cashFlowEntries.date,
              type: cashFlowEntries.type,
              amount: cashFlowEntries.amount,
              description: cashFlowEntries.description,
            })
            .from(cashFlowEntries)
            .where(and(eq(cashFlowEntries.companyId, company.id), isNotNull(cashFlowEntries.investmentId), inArray(cashFlowEntries.type, ["economia", "entrada"])))
            .orderBy(asc(cashFlowEntries.date)),
        ]);

  return (
    <>
      <PageHeader
        title="Aplicações financeiras"
        description="Aportes entram no fluxo de caixa como Economia e resgates como Entrada; informe o saldo atualizado para incluir os rendimentos."
      />
      <InvestmentsClient
        investments={list}
        valuations={valuations.map((v) => ({ id: v.id, investmentId: v.investmentId, date: v.date, cents: toCents(v.balance) }))}
        movements={movements.map((m) => ({
          investmentId: m.investmentId!,
          date: m.date,
          kind: m.type === "economia" ? ("aporte" as const) : ("resgate" as const),
          cents: toCents(m.amount),
          description: m.description,
        }))}
        today={todayIso()}
      />
    </>
  );
}
