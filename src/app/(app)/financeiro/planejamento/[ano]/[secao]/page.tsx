import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoCompany } from "@/components/page-header";
import { db } from "@/db";
import { planVersions } from "@/db/schema";
import { getInvestmentOptions } from "@/lib/data/investments";
import { getPageContext } from "@/lib/page-context";
import { buildDataset, getPlan } from "@/lib/plan/data";
import { isPlanSection, PLAN_SECTION_LABELS } from "@/lib/plan/types";
import { PlanWorkspace } from "../../plan-workspace";

export async function generateMetadata({ params }: PageProps<"/financeiro/planejamento/[ano]/[secao]">): Promise<Metadata> {
  const { ano, secao } = await params;
  return { title: `${isPlanSection(secao) ? PLAN_SECTION_LABELS[secao].title : "Plano"} · Plano ${ano}` };
}

export default async function PlanSectionPage({ params }: PageProps<"/financeiro/planejamento/[ano]/[secao]">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const { ano, secao } = await params;
  const year = Number(ano);
  if (!Number.isInteger(year) || !isPlanSection(secao)) notFound();
  const plan = await getPlan(company.id, year);
  if (!plan) notFound();

  const [dataset, investments, versions] = await Promise.all([
    buildDataset(company.id, plan),
    getInvestmentOptions(company.id),
    db
      .select({ id: planVersions.id, number: planVersions.number, label: planVersions.label, createdAt: planVersions.createdAt })
      .from(planVersions)
      .where(eq(planVersions.planId, plan.id))
      .orderBy(desc(planVersions.number)),
  ]);

  return (
    <PlanWorkspace
      section={secao}
      plan={{
        id: plan.id,
        year: plan.year,
        title: plan.title,
        diagnosisFrom: plan.diagnosisFrom,
        diagnosisTo: plan.diagnosisTo,
        content: plan.content[secao],
        allContent: plan.content,
        budget: plan.budget,
        goals: plan.goals,
        scenarios: plan.scenarios,
      }}
      dataset={dataset}
      investments={investments}
      versions={versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }))}
    />
  );
}
