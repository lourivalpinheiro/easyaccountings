import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

export const AVATARS_BUCKET = "avatars";
export const ANEXOS_BUCKET = "anexos";

const STORAGE_TIMEOUT_MS = 15_000;

/** Nunca deixa uma chamada ao Storage travar a resposta indefinidamente se a rede/API ficar lenta. */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Tempo esgotado: ${label}.`)), STORAGE_TIMEOUT_MS)),
  ]);
}

function extOf(fileName: string) {
  const i = fileName.lastIndexOf(".");
  return i === -1 ? "" : fileName.slice(i);
}

export function randomStoragePath(prefix: string, fileName: string) {
  return `${prefix}/${randomUUID()}${extOf(fileName)}`;
}

export async function uploadFile(bucket: string, path: string, file: File) {
  const { error } = await withTimeout(
    createAdminClient().storage.from(bucket).upload(path, file, { contentType: file.type || "application/octet-stream" }),
    "enviar arquivo",
  );
  if (error) throw new Error(`Falha ao enviar arquivo: ${error.message}`);
}

export async function deleteFile(bucket: string, path: string) {
  const { error } = await withTimeout(createAdminClient().storage.from(bucket).remove([path]), "excluir arquivo");
  if (error) throw new Error(`Falha ao excluir arquivo: ${error.message}`);
}

export function publicUrl(bucket: string, path: string) {
  return createAdminClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function signedUrl(bucket: string, path: string, expiresIn = 60) {
  const { data, error } = await withTimeout(
    createAdminClient().storage.from(bucket).createSignedUrl(path, expiresIn),
    "gerar link",
  );
  if (error || !data) throw new Error(`Falha ao gerar link: ${error?.message}`);
  return data.signedUrl;
}
