"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { run, UserError, type ActionResult } from "@/lib/action-utils";
import { requireUser } from "@/lib/auth/session";
import { AVATARS_BUCKET, deleteFile, randomStoragePath, uploadFile } from "@/lib/storage";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const nameSchema = z.object({ name: z.string().trim().min(2, "Informe o nome.").max(120) });

export async function updateProfile(input: z.input<typeof nameSchema>): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const data = nameSchema.parse(input);
    await db.update(profiles).set({ name: data.name }).where(eq(profiles.id, user.id));
    revalidatePath("/", "layout");
  });
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecione uma imagem.");
    if (file.size > MAX_AVATAR_BYTES) throw new UserError("A imagem deve ter até 5 MB.");
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) throw new UserError("Envie uma imagem PNG, JPEG, WEBP ou GIF.");

    const path = randomStoragePath(`profiles/${user.id}`, file.name);
    await uploadFile(AVATARS_BUCKET, path, file);

    const previous = user.avatarPath;
    await db.update(profiles).set({ avatarPath: path }).where(eq(profiles.id, user.id));
    if (previous) void deleteFile(AVATARS_BUCKET, previous).catch(() => {});
    revalidatePath("/", "layout");
  });
}

export async function removeAvatar(): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    if (!user.avatarPath) return;
    await db.update(profiles).set({ avatarPath: null }).where(eq(profiles.id, user.id));
    void deleteFile(AVATARS_BUCKET, user.avatarPath).catch(() => {});
    revalidatePath("/", "layout");
  });
}
