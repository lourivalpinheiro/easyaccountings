import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attachments, cashFlowEntries, journalEntries } from "@/db/schema";
import { getPublishedCompany } from "@/lib/public-company";
import { ANEXOS_BUCKET, signedUrl } from "@/lib/storage";

export async function GET(_request: Request, { params }: RouteContext<"/publico/[token]/anexos/[id]">) {
  const { token, id } = await params;
  const company = await getPublishedCompany(token);

  const [row] = await db
    .select({ storagePath: attachments.storagePath })
    .from(attachments)
    .leftJoin(journalEntries, eq(attachments.journalEntryId, journalEntries.id))
    .leftJoin(cashFlowEntries, eq(attachments.cashFlowEntryId, cashFlowEntries.id))
    .where(
      and(
        eq(attachments.id, id),
        eq(attachments.isPublic, true),
        or(eq(journalEntries.companyId, company.id), eq(cashFlowEntries.companyId, company.id)),
      ),
    );
  if (!row) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });

  const url = await signedUrl(ANEXOS_BUCKET, row.storagePath, 60);
  return NextResponse.redirect(url);
}
