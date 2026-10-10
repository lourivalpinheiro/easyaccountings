"use server";

import { and, eq, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  financialPlans,
  investments,
  planBudgetItems,
  planFiles,
  planGoals,
  planScenarios,
  planVersions,
} from "@/db/schema";
import { centsToDecimal } from "@/lib/accounting";
import { companyAction, UserError } from "@/lib/action-utils";
import { FLOW_TYPES } from "@/lib/cash-flow-types";
import { todayIso } from "@/lib/period";
import { buildDataset, getPlan } from "@/lib/plan/data";
import { DEFAULT_SCENARIOS } from "@/lib/plan/templates";
import { PLAN_SECTIONS, type PlanSnapshot } from "@/lib/plan/types";
import { ANEXOS_BUCKET, randomStoragePath, uploadFile } from "@/lib/storage";

const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const revalidate = () => revalidatePath("/financeiro/planejamento", "layout");

async function ownedPlan(planId: string, companyId: string) {
  const [plan] = await db
    .select({ id: financialPlans.id, year: financialPlans.year })
    .from(financialPlans)
    .where(and(eq(financialPlans.id, planId), eq(financialPlans.companyId, companyId)));
  if (!plan) throw new UserError("Plano não encontrado.");
  return plan;
}

/** Diagnóstico padrão: o ano anterior ao do plano; para um ano futuro, os últimos 12 meses. */
function defaultDiagnosis(year: number) {
  const today = todayIso();
  const currentYear = Number(today.slice(0, 4));
  if (year <= currentYear) return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
  const [y, m] = today.split("-").map(Number);
  const fromMonth = m === 12 ? 1 : m + 1;
  const fromYear = m === 12 ? y : y - 1;
  return { from: `${fromYear}-${String(fromMonth).padStart(2, "0")}-01`, to: today };
}

export async function createPlan(input: { year: number; title: string }) {
  return companyAction(async ({ companyId, userId }) => {
    const year = Math.floor(input.year);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) throw new UserError("Ano inválido.");
    const title = input.title.trim() || `Planejamento financeiro ${year}`;
    const diagnosis = defaultDiagnosis(year);
    await db.transaction(async (tx) => {
      const [plan] = await tx
        .insert(financialPlans)
        .values({
          companyId,
          year,
          title,
          diagnosisFrom: diagnosis.from,
          diagnosisTo: diagnosis.to,
          content: {},
          createdBy: userId,
        })
        .returning({ id: financialPlans.id });
      await tx.insert(planScenarios).values(
        DEFAULT_SCENARIOS.map((s, i) => ({
          planId: plan.id,
          position: i,
          name: s.name,
          color: s.color,
          revenueGrowth: String(s.revenueGrowth),
          expenseGrowth: String(s.expenseGrowth),
          inflation: String(s.inflation),
          investmentReturn: String(s.investmentReturn),
          horizonMonths: 12,
        })),
      );
    });
    revalidate();
    return { year };
  });
}

export async function deletePlan(planId: string) {
  return companyAction(async ({ companyId }) => {
    await ownedPlan(planId, companyId);
    await db.delete(financialPlans).where(eq(financialPlans.id, planId));
    revalidate();
  });
}

const metaSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título.").max(160),
    diagnosisFrom: z.iso.date("Data inicial inválida."),
    diagnosisTo: z.iso.date("Data final inválida."),
  })
  .refine((v) => v.diagnosisFrom <= v.diagnosisTo, { message: "O fim do diagnóstico deve ser depois do início." });

export async function updatePlanMeta(planId: string, input: z.input<typeof metaSchema>) {
  return companyAction(async ({ companyId }) => {
    await ownedPlan(planId, companyId);
    const parsed = metaSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    await db.update(financialPlans).set(parsed.data).where(eq(financialPlans.id, planId));
    revalidate();
  });
}

/** Grava o texto de uma seção (JSON do editor). Chamado pelo salvamento automático. */
export async function saveSectionContent(planId: string, section: string, doc: unknown) {
  return companyAction(async ({ companyId }) => {
    await ownedPlan(planId, companyId);
    if (!(PLAN_SECTIONS as readonly string[]).includes(section)) throw new UserError("Seção inválida.");
    if (!doc || typeof doc !== "object" || (doc as { type?: unknown }).type !== "doc") throw new UserError("Conteúdo inválido.");
    if (JSON.stringify(doc).length > MAX_CONTENT_BYTES) throw new UserError("O texto da seção passou do limite de 2 MB.");
    await db
      .update(financialPlans)
      // Atualiza só a chave da seção, de forma atômica (duas seções salvas ao mesmo tempo não se sobrescrevem).
      .set({ content: sql`jsonb_set(${financialPlans.content}, ${`{${section}}`}::text[], ${JSON.stringify(doc)}::jsonb)` })
      .where(eq(financialPlans.id, planId));
    return { savedAt: new Date().toISOString() };
  });
}

const budgetSchema = z.array(
  z.object({
    type: z.enum(FLOW_TYPES),
    category: z.string().trim().min(1).max(80),
    month: z.number().int().min(1).max(12),
    cents: z.number().int().nonnegative(),
  }),
);

/** Substitui o orçamento do plano (linhas zeradas não são gravadas). */
export async function savePlanBudget(planId: string, items: z.input<typeof budgetSchema>) {
  return companyAction(async ({ companyId }) => {
    await ownedPlan(planId, companyId);
    const parsed = budgetSchema.safeParse(items);
    if (!parsed.success) throw new UserError("Orçamento inválido: verifique categorias e valores.");
    const merged = new Map<string, (typeof parsed.data)[number]>();
    for (const i of parsed.data) {
      if (i.cents === 0) continue;
      const key = `${i.type}|${i.category.toLowerCase()}|${i.month}`;
      const prev = merged.get(key);
      merged.set(key, prev ? { ...prev, cents: prev.cents + i.cents } : i);
    }
    await db.transaction(async (tx) => {
      await tx.delete(planBudgetItems).where(eq(planBudgetItems.planId, planId));
      if (merged.size > 0) {
        await tx.insert(planBudgetItems).values(
          [...merged.values()].map((i) => ({ planId, type: i.type, category: i.category, month: i.month, amount: centsToDecimal(i.cents) })),
        );
      }
    });
    revalidate();
  });
}

const goalSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome da meta.").max(120),
  targetCents: z.number().int().positive("Informe o valor da meta."),
  initialCents: z.number().int().nonnegative(),
  deadline: z.iso.date("Informe o prazo."),
  priority: z.number().int().min(1).max(3),
  annualReturn: z.number().min(-100).max(1000),
  investmentId: z.uuid().nullable(),
  notes: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => v || null),
});

export async function saveGoal(planId: string, input: z.input<typeof goalSchema>) {
  return companyAction(async ({ companyId }) => {
    await ownedPlan(planId, companyId);
    const parsed = goalSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, targetCents, initialCents, annualReturn, ...g } = parsed.data;
    if (g.investmentId) {
      const [inv] = await db
        .select({ id: investments.id })
        .from(investments)
        .where(and(eq(investments.id, g.investmentId), eq(investments.companyId, companyId)));
      if (!inv) throw new UserError("Aplicação não encontrada.");
    }
    const values = {
      ...g,
      targetAmount: centsToDecimal(targetCents),
      initialAmount: centsToDecimal(initialCents),
      annualReturn: String(annualReturn),
    };
    if (id) {
      await db.update(planGoals).set(values).where(and(eq(planGoals.id, id), eq(planGoals.planId, planId)));
    } else {
      const [{ position }] = await db.select({ position: max(planGoals.position) }).from(planGoals).where(eq(planGoals.planId, planId));
      await db.insert(planGoals).values({ ...values, planId, position: (position ?? -1) + 1 });
    }
    revalidate();
  });
}

export async function deleteGoal(planId: string, goalId: string) {
  return companyAction(async ({ companyId }) => {
    await ownedPlan(planId, companyId);
    await db.delete(planGoals).where(and(eq(planGoals.id, goalId), eq(planGoals.planId, planId)));
    revalidate();
  });
}

const scenarioSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome do cenário.").max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  revenueGrowth: z.number().min(-100).max(1000),
  expenseGrowth: z.number().min(-100).max(1000),
  inflation: z.number().min(-100).max(1000),
  investmentReturn: z.number().min(-100).max(1000),
  horizonMonths: z.number().int().min(1, "Horizonte mínimo de 1 mês.").max(120, "Horizonte máximo de 120 meses."),
  events: z
    .array(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, "Mês do evento inválido."),
        description: z.string().trim().min(1, "Descreva o evento.").max(120),
        cents: z.number().int(),
      }),
    )
    .max(100),
});

export async function saveScenario(planId: string, input: z.input<typeof scenarioSchema>) {
  return companyAction(async ({ companyId }) => {
    await ownedPlan(planId, companyId);
    const parsed = scenarioSchema.safeParse(input);
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const { id, revenueGrowth, expenseGrowth, inflation, investmentReturn, ...s } = parsed.data;
    const values = {
      ...s,
      revenueGrowth: String(revenueGrowth),
      expenseGrowth: String(expenseGrowth),
      inflation: String(inflation),
      investmentReturn: String(investmentReturn),
    };
    if (id) {
      await db.update(planScenarios).set(values).where(and(eq(planScenarios.id, id), eq(planScenarios.planId, planId)));
    } else {
      const [{ position }] = await db.select({ position: max(planScenarios.position) }).from(planScenarios).where(eq(planScenarios.planId, planId));
      await db.insert(planScenarios).values({ ...values, planId, position: (position ?? -1) + 1 });
    }
    revalidate();
  });
}

export async function deleteScenario(planId: string, scenarioId: string) {
  return companyAction(async ({ companyId }) => {
    await ownedPlan(planId, companyId);
    await db.delete(planScenarios).where(and(eq(planScenarios.id, scenarioId), eq(planScenarios.planId, planId)));
    revalidate();
  });
}

/** Indicadores mais recentes do Banco Central (SGS): IPCA acumulado em 12 meses e meta Selic. */
export async function fetchBcbRates() {
  return companyAction(async () => {
    const last = async (series: number) => {
      const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`, {
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 3600 },
      });
      if (!res.ok) throw new UserError("Não foi possível consultar o Banco Central agora.");
      const [row] = (await res.json()) as { data: string; valor: string }[];
      return { date: row.data, value: Number(row.valor) };
    };
    try {
      const [ipca, selic] = await Promise.all([last(13522), last(432)]);
      return { ipca, selic };
    } catch (e) {
      if (e instanceof UserError) throw e;
      throw new UserError("Não foi possível consultar o Banco Central agora.");
    }
  });
}

// ---------- Versões ----------

async function snapshotOf(companyId: string, year: number): Promise<PlanSnapshot> {
  const plan = await getPlan(companyId, year);
  if (!plan) throw new UserError("Plano não encontrado.");
  const dataset = await buildDataset(companyId, plan);
  return {
    title: plan.title,
    diagnosisFrom: plan.diagnosisFrom,
    diagnosisTo: plan.diagnosisTo,
    content: plan.content,
    budget: plan.budget,
    goals: plan.goals,
    scenarios: plan.scenarios,
    dataset,
  };
}

async function insertVersion(planId: string, label: string, snapshot: PlanSnapshot, userId: string) {
  const [{ last }] = await db.select({ last: max(planVersions.number) }).from(planVersions).where(eq(planVersions.planId, planId));
  const number = (last ?? 0) + 1;
  await db.insert(planVersions).values({ planId, number, label, snapshot, createdBy: userId });
  return number;
}

export async function saveVersion(planId: string, label: string) {
  return companyAction(async ({ companyId, userId }) => {
    const plan = await ownedPlan(planId, companyId);
    const clean = label.trim().slice(0, 120);
    const number = await insertVersion(planId, clean || "Versão sem descrição", await snapshotOf(companyId, plan.year), userId);
    revalidate();
    return { number };
  });
}

/** Volta o plano para uma versão salva; o estado atual é guardado antes como uma nova versão. */
export async function restoreVersion(planId: string, versionId: string) {
  return companyAction(async ({ companyId, userId }) => {
    const plan = await ownedPlan(planId, companyId);
    const [version] = await db
      .select()
      .from(planVersions)
      .where(and(eq(planVersions.id, versionId), eq(planVersions.planId, planId)));
    if (!version) throw new UserError("Versão não encontrada.");
    const snap = version.snapshot as unknown as PlanSnapshot;
    await insertVersion(planId, `Antes de restaurar a versão ${version.number}`, await snapshotOf(companyId, plan.year), userId);

    // Metas ligadas a aplicações que não existem mais perdem o vínculo.
    const validInvestments = new Set(
      (await db.select({ id: investments.id }).from(investments).where(eq(investments.companyId, companyId))).map((i) => i.id),
    );
    await db.transaction(async (tx) => {
      await tx
        .update(financialPlans)
        .set({ title: snap.title, diagnosisFrom: snap.diagnosisFrom, diagnosisTo: snap.diagnosisTo, content: snap.content })
        .where(eq(financialPlans.id, planId));
      await tx.delete(planBudgetItems).where(eq(planBudgetItems.planId, planId));
      await tx.delete(planGoals).where(eq(planGoals.planId, planId));
      await tx.delete(planScenarios).where(eq(planScenarios.planId, planId));
      if (snap.budget.length > 0) {
        await tx.insert(planBudgetItems).values(
          snap.budget.map((b) => ({ planId, type: b.type, category: b.category, month: b.month, amount: centsToDecimal(b.cents) })),
        );
      }
      if (snap.goals.length > 0) {
        await tx.insert(planGoals).values(
          snap.goals.map((g, i) => ({
            planId,
            position: i,
            name: g.name,
            targetAmount: centsToDecimal(g.targetCents),
            initialAmount: centsToDecimal(g.initialCents),
            deadline: g.deadline,
            priority: g.priority,
            annualReturn: String(g.annualReturn),
            investmentId: g.investmentId && validInvestments.has(g.investmentId) ? g.investmentId : null,
            notes: g.notes,
          })),
        );
      }
      if (snap.scenarios.length > 0) {
        await tx.insert(planScenarios).values(
          snap.scenarios.map((s, i) => ({
            planId,
            position: i,
            name: s.name,
            color: s.color,
            revenueGrowth: String(s.revenueGrowth),
            expenseGrowth: String(s.expenseGrowth),
            inflation: String(s.inflation),
            investmentReturn: String(s.investmentReturn),
            horizonMonths: s.horizonMonths,
            events: s.events,
          })),
        );
      }
    });
    revalidate();
  });
}

export async function deleteVersion(planId: string, versionId: string) {
  return companyAction(async ({ companyId }) => {
    await ownedPlan(planId, companyId);
    await db.delete(planVersions).where(and(eq(planVersions.id, versionId), eq(planVersions.planId, planId)));
    revalidate();
  });
}

// ---------- Arquivos e imagens dos textos ----------

export async function uploadPlanFile(planId: string, formData: FormData) {
  return companyAction(async ({ companyId, userId }) => {
    await ownedPlan(planId, companyId);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecione um arquivo.");
    if (file.size > MAX_FILE_BYTES) throw new UserError("O arquivo deve ter até 15 MB.");
    const path = randomStoragePath(`plano/${planId}`, file.name);
    await uploadFile(ANEXOS_BUCKET, path, file);
    const [row] = await db
      .insert(planFiles)
      .values({ planId, fileName: file.name, storagePath: path, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, createdBy: userId })
      .returning({ id: planFiles.id });
    return { id: row.id, url: `/financeiro/planejamento/arquivos/${row.id}`, fileName: file.name, mimeType: file.type, sizeBytes: file.size };
  });
}
