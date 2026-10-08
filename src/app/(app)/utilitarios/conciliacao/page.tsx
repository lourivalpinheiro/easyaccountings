import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { historyCodes } from "@/db/schema";
import { getBankStatements, getKnots, getPendingTransactions, getReconciledTransactions } from "@/lib/data/reconciliation";
import { getChart } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { ReconciliationClient } from "./reconciliation-client";

export const metadata: Metadata = { title: "Conciliação bancária" };

export default async function ReconciliationPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;

  const [chart, statements, pending, reconciled, knots, histories] = await Promise.all([
    getChart(company.id),
    getBankStatements(company.id),
    getPendingTransactions(company.id),
    getReconciledTransactions(company.id),
    getKnots(company.id),
    db
      .select({ code: historyCodes.code, description: historyCodes.description })
      .from(historyCodes)
      .where(eq(historyCodes.companyId, company.id))
      .orderBy(asc(historyCodes.code)),
  ]);

  return (
    <>
      <PageHeader
        title="Conciliação bancária"
        description="Importe o extrato em OFX e concilie com o módulo contábil, o financeiro, ou os dois."
      />
      <ReconciliationClient
        accounts={chart.map(({ id, reducedCode, classification, name, analytic }) => ({ id, reducedCode, classification, name, analytic }))}
        statements={statements.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
        pending={pending}
        reconciled={reconciled}
        knots={knots}
        histories={histories}
      />
    </>
  );
}
