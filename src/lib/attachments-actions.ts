"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { attachments, cashFlowEntries, journalEntries } from "@/db/schema";
import { companyAction, UserError } from "@/lib/action-utils";
import { ANEXOS_BUCKET, deleteFile, randomStoragePath, signedUrl, uploadFile } from "@/lib/storage";

export type EntryType = "lancamento" | "movimentacao";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

async function assertEntryOwnership(entryType: EntryType, entryId: string, companyId: string) {
  const table = entryType === "lancamento" ? journalEntries : cashFlowEntries;
  const [row] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, entryId), eq(table.companyId, companyId)));
  if (!row) throw new UserError(entryType === "lancamento" ? "Lançamento não encontrado." : "Movimentação não encontrada.");
}

/** Busca o anexo garantindo que pertence à empresa ativa (via lançamento ou movimentação). */
async function findOwnedAttachment(id: string, companyId: string) {
  const [row] = await db
    .select({
      id: attachments.id,
      storagePath: attachments.storagePath,
      journalEntryId: attachments.journalEntryId,
      cashFlowEntryId: attachments.cashFlowEntryId,
    })
    .from(attachments)
    .leftJoin(journalEntries, eq(attachments.journalEntryId, journalEntries.id))
    .leftJoin(cashFlowEntries, eq(attachments.cashFlowEntryId, cashFlowEntries.id))
    .where(and(eq(attachments.id, id), or(eq(journalEntries.companyId, companyId), eq(cashFlowEntries.companyId, companyId))));
  if (!row) throw new UserError("Anexo não encontrado.");
  return row;
}

export async function uploadAttachments(entryType: EntryType, entryId: string, formData: FormData) {
  return companyAction(async ({ companyId, userId }) => {
    await assertEntryOwnership(entryType, entryId, companyId);
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new UserError("Selecione ao menos um arquivo.");
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) throw new UserError(`"${f.name}" passa de 15 MB.`);
    }
    for (const file of files) {
      const path = randomStoragePath(`${entryType}/${entryId}`, file.name);
      await uploadFile(ANEXOS_BUCKET, path, file);
      await db.insert(attachments).values({
        journalEntryId: entryType === "lancamento" ? entryId : null,
        cashFlowEntryId: entryType === "movimentacao" ? entryId : null,
        fileName: file.name,
        storagePath: path,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        createdBy: userId,
      });
    }
    revalidatePath("/", "layout");
  });
}

export async function replaceAttachment(id: string, formData: FormData) {
  return companyAction(async ({ companyId }) => {
    const row = await findOwnedAttachment(id, companyId);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecione um arquivo.");
    if (file.size > MAX_FILE_BYTES) throw new UserError("O arquivo deve ter até 15 MB.");

    const entryType: EntryType = row.journalEntryId ? "lancamento" : "movimentacao";
    const entryId = row.journalEntryId ?? row.cashFlowEntryId!;
    const path = randomStoragePath(`${entryType}/${entryId}`, file.name);
    await uploadFile(ANEXOS_BUCKET, path, file);
    await db
      .update(attachments)
      .set({ fileName: file.name, storagePath: path, mimeType: file.type || "application/octet-stream", sizeBytes: file.size })
      .where(eq(attachments.id, id));
    // Não bloqueia a resposta por causa da limpeza do arquivo antigo no Storage.
    void deleteFile(ANEXOS_BUCKET, row.storagePath).catch(() => {});
    revalidatePath("/", "layout");
  });
}

export async function deleteAttachment(id: string) {
  return companyAction(async ({ companyId }) => {
    const row = await findOwnedAttachment(id, companyId);
    await db.delete(attachments).where(eq(attachments.id, id));
    void deleteFile(ANEXOS_BUCKET, row.storagePath).catch(() => {});
    revalidatePath("/", "layout");
  });
}

export async function setAttachmentVisibility(id: string, isPublic: boolean) {
  return companyAction(async ({ companyId }) => {
    await findOwnedAttachment(id, companyId);
    await db.update(attachments).set({ isPublic }).where(eq(attachments.id, id));
    revalidatePath("/", "layout");
  });
}

export async function getAttachmentUrl(id: string) {
  return companyAction(async ({ companyId }) => {
    const row = await findOwnedAttachment(id, companyId);
    return { url: await signedUrl(ANEXOS_BUCKET, row.storagePath, 60) };
  });
}
