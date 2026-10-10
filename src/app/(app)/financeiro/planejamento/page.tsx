import { count, desc, eq, max } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { financialPlans, planVersions } from "@/db/schema";
import { getPageContext } from "@/lib/page-context";
import { PlansClient } from "./plans-client";

export const metadata: Metadata = { title: "Planejamento financeiro" };

export default async function PlansPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const plans = await db
    .select({
      id: financialPlans.id,
      year: financialPlans.year,
      title: financialPlans.title,
      updatedAt: financialPlans.updatedAt,
      versions: count(planVersions.id),
      lastVersion: max(planVersions.number),
    })
    .from(financialPlans)
    .leftJoin(planVersions, eq(planVersions.planId, financialPlans.id))
    .where(eq(financialPlans.companyId, company.id))
    .groupBy(financialPlans.id)
    .orderBy(desc(financialPlans.year));

  return (
    <>
      <PageHeader
        title="Planejamento financeiro"
        description="Um plano por ano, com diagnóstico, metas, orçamento e cenários. Cada plano pode ser exportado em PDF e tem histórico de versões."
      />
      <PlansClient plans={plans.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() }))} />
    </>
  );
}
