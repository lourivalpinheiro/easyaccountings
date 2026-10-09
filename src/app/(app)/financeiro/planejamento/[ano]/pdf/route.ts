import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { financialPlans, planFiles, planVersions } from "@/db/schema";
import { formatDocument, formatNowBrasilia, PERSON_LABELS } from "@/lib/accounting";
import { requireUser } from "@/lib/auth/session";
import { getActiveCompany } from "@/lib/company";
import { buildDataset, getPlan } from "@/lib/plan/data";
import { collectImageSources, renderPlanPdf, type PdfImages } from "@/lib/plan/pdf";
import type { PlanSnapshot } from "@/lib/plan/types";
import { ANEXOS_BUCKET, downloadFile } from "@/lib/storage";

export const maxDuration = 60;

const FILE_URL = /^\/financeiro\/planejamento\/arquivos\/([0-9a-f-]{36})$/i;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const formatOf = (mime: string) => (/png/i.test(mime) ? "png" : /jpe?g/i.test(mime) ? "jpg" : null);

/** Baixa as imagens do texto: arquivos do próprio plano (Storage) ou endereços externos PNG/JPEG. */
async function loadImages(sources: string[], planId: string): Promise<PdfImages> {
  const images: PdfImages = new Map();
  const ids = sources.map((src) => src.match(FILE_URL)?.[1]).filter((id): id is string => Boolean(id));
  const files = ids.length
    ? await db
        .select({ id: planFiles.id, storagePath: planFiles.storagePath, mimeType: planFiles.mimeType })
        .from(planFiles)
        .where(and(eq(planFiles.planId, planId), inArray(planFiles.id, ids)))
    : [];
  await Promise.all(
    sources.map(async (src) => {
      try {
        const id = src.match(FILE_URL)?.[1];
        if (id) {
          const file = files.find((f) => f.id === id);
          const format = file && formatOf(file.mimeType);
          images.set(src, file && format ? { data: await downloadFile(ANEXOS_BUCKET, file.storagePath), format } : null);
        } else if (/^https:\/\//i.test(src)) {
          const res = await fetch(src, { signal: AbortSignal.timeout(8000) });
          const format = formatOf(res.headers.get("content-type") ?? "");
          const data = Buffer.from(await res.arrayBuffer());
          images.set(src, res.ok && format && data.length <= MAX_IMAGE_BYTES ? { data, format } : null);
        } else {
          images.set(src, null);
        }
      } catch {
        images.set(src, null);
      }
    }),
  );
  return images;
}

export async function GET(request: Request, { params }: RouteContext<"/financeiro/planejamento/[ano]/pdf">) {
  const user = await requireUser();
  const company = await getActiveCompany(user);
  if (!company) return NextResponse.json({ error: "Selecione uma empresa." }, { status: 400 });
  const { ano } = await params;
  const year = Number(ano);
  const plan = Number.isInteger(year) ? await getPlan(company.id, year) : null;
  if (!plan) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });

  const versionId = new URL(request.url).searchParams.get("versao");
  let snapshot: PlanSnapshot;
  let versionLabel: string | null = null;
  if (versionId) {
    const [version] = /^[0-9a-f-]{36}$/i.test(versionId)
      ? await db
          .select({ number: planVersions.number, label: planVersions.label, snapshot: planVersions.snapshot })
          .from(planVersions)
          .innerJoin(financialPlans, eq(financialPlans.id, planVersions.planId))
          .where(and(eq(planVersions.id, versionId), eq(planVersions.planId, plan.id)))
      : [];
    if (!version) return NextResponse.json({ error: "Versão não encontrada." }, { status: 404 });
    snapshot = version.snapshot as unknown as PlanSnapshot;
    versionLabel = `Versão ${version.number}: ${version.label}`;
  } else {
    snapshot = { ...plan, dataset: await buildDataset(company.id, plan) };
  }

  const images = await loadImages(collectImageSources(snapshot.content), plan.id);
  const document = company.document ? `${PERSON_LABELS[company.personType].document} ${formatDocument(company.personType, company.document)}` : "";
  const pdf = await renderPlanPdf(
    snapshot,
    { companyName: company.legalName, companyDocument: document, generatedAt: formatNowBrasilia(), versionLabel },
    images,
    process.env.SITE_URL ?? new URL(request.url).origin,
  );

  const fileName = `planejamento-${year}${versionLabel ? `-versao` : ""}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
