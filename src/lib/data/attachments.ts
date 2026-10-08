import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attachments, cashFlowEntries, journalEntries } from "@/db/schema";

export type AttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isPublic: boolean;
};

function groupBy<K extends string>(rows: (AttachmentRow & { key: K | null })[]) {
  const map = new Map<K, AttachmentRow[]>();
  for (const { key, ...row } of rows) {
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

export async function getAttachmentsByJournalEntry(entryIds: string[]) {
  if (entryIds.length === 0) return new Map<string, AttachmentRow[]>();
  const rows = await db
    .select({
      id: attachments.id,
      fileName: attachments.fileName,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
      isPublic: attachments.isPublic,
      key: attachments.journalEntryId,
    })
    .from(attachments)
    .where(inArray(attachments.journalEntryId, entryIds));
  return groupBy(rows);
}

export type PublicAttachmentRow = AttachmentRow & { entryDate: string; entryLabel: string };

/** Anexos marcados como públicos de lançamentos contábeis da empresa (para a página pública). */
export async function getPublicJournalAttachments(companyId: string): Promise<PublicAttachmentRow[]> {
  const rows = await db
    .select({
      id: attachments.id,
      fileName: attachments.fileName,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
      isPublic: attachments.isPublic,
      entryDate: journalEntries.date,
      number: journalEntries.number,
      description: journalEntries.description,
    })
    .from(attachments)
    .innerJoin(journalEntries, eq(attachments.journalEntryId, journalEntries.id))
    .where(and(eq(journalEntries.companyId, companyId), eq(attachments.isPublic, true)))
    .orderBy(journalEntries.date);
  return rows.map(({ number, description, ...r }) => ({ ...r, entryLabel: `Lançamento nº ${number} - ${description}` }));
}

/** Anexos marcados como públicos de movimentações do fluxo de caixa da empresa (para a página pública). */
export async function getPublicCashFlowAttachments(companyId: string): Promise<PublicAttachmentRow[]> {
  const rows = await db
    .select({
      id: attachments.id,
      fileName: attachments.fileName,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
      isPublic: attachments.isPublic,
      entryDate: cashFlowEntries.date,
      description: cashFlowEntries.description,
    })
    .from(attachments)
    .innerJoin(cashFlowEntries, eq(attachments.cashFlowEntryId, cashFlowEntries.id))
    .where(and(eq(cashFlowEntries.companyId, companyId), eq(attachments.isPublic, true)))
    .orderBy(cashFlowEntries.date);
  return rows.map(({ description, ...r }) => ({ ...r, entryLabel: description }));
}

export async function getAttachmentsByCashFlowEntry(entryIds: string[]) {
  if (entryIds.length === 0) return new Map<string, AttachmentRow[]>();
  const rows = await db
    .select({
      id: attachments.id,
      fileName: attachments.fileName,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
      isPublic: attachments.isPublic,
      key: attachments.cashFlowEntryId,
    })
    .from(attachments)
    .where(inArray(attachments.cashFlowEntryId, entryIds));
  return groupBy(rows);
}
