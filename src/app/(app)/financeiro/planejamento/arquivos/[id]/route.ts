import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { financialPlans, planFiles } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { listAccessibleCompanies } from "@/lib/company";
import { ANEXOS_BUCKET, signedUrl } from "@/lib/storage";

/** Imagens e arquivos dos textos do plano: só para quem acessa a empresa do plano (via link temporário do Storage). */
export async function GET(_request: Request, { params }: RouteContext<"/financeiro/planejamento/arquivos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  const user = await requireUser();
  const [row] = await db
    .select({ storagePath: planFiles.storagePath, companyId: financialPlans.companyId })
    .from(planFiles)
    .innerJoin(financialPlans, eq(financialPlans.id, planFiles.planId))
    .where(eq(planFiles.id, id));
  const accessible = await listAccessibleCompanies(user);
  if (!row || !accessible.some((c) => c.id === row.companyId)) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
  return NextResponse.redirect(await signedUrl(ANEXOS_BUCKET, row.storagePath, 300));
}
