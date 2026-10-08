"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { companies, profiles } from "@/db/schema";
import { isValidDocument, PERSON_LABELS } from "@/lib/accounting";
import { run, UserError, type ActionResult } from "@/lib/action-utils";
import { requireAdmin } from "@/lib/auth/session";
import { seedCompany } from "@/lib/data/seed-company";
import { newPublicToken } from "@/lib/public-company";
import { createAdminClient } from "@/lib/supabase/server";

const companySchema = z
  .object({
    personType: z.enum(["PF", "PJ", "INF"]),
    legalName: z.string().trim().min(2, "Informe o nome ou a razão social."),
    document: z.string().transform((v) => v.replace(/\D/g, "")),
  })
  .transform((c) => ({ ...c, document: c.personType === "INF" ? null : c.document }))
  .superRefine((c, ctx) => {
    if (c.document === null) return;
    if (!isValidDocument(c.personType, c.document)) {
      ctx.addIssue({ code: "custom", message: `${PERSON_LABELS[c.personType].document} inválido.` });
    }
  });

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new UserError(r.error.issues[0].message);
  return r.data;
}

export async function saveCompany(input: {
  id?: string;
  personType: "PF" | "PJ" | "INF";
  legalName: string;
  document: string;
}): Promise<ActionResult> {
  await requireAdmin();
  return run(async () => {
    const data = parse(companySchema, input);
    if (input.id) {
      await db.update(companies).set(data).where(eq(companies.id, input.id));
    } else {
      await db.transaction(async (tx) => {
        const [company] = await tx.insert(companies).values(data).returning({ id: companies.id });
        await seedCompany(tx, company.id);
      });
    }
    revalidatePath("/", "layout");
  });
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  await requireAdmin();
  return run(async () => {
    await db.delete(companies).where(eq(companies.id, id));
    revalidatePath("/", "layout");
  });
}

const userSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  email: z.email("E-mail inválido.").transform((v) => v.toLowerCase()),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  role: z.enum(["admin", "user"]),
});

export async function createUser(input: z.input<typeof userSchema>): Promise<ActionResult> {
  await requireAdmin();
  return run(async () => {
    const data = parse(userSchema, input);
    const supabase = createAdminClient();
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (error || !created.user) {
      throw new UserError(
        error?.code === "email_exists" ? "Já existe um usuário com este e-mail." : `Não foi possível criar o usuário: ${error?.message}`,
      );
    }
    try {
      await db.insert(profiles).values({ id: created.user.id, name: data.name, email: data.email, role: data.role });
    } catch (e) {
      await supabase.auth.admin.deleteUser(created.user.id);
      throw e;
    }
    revalidatePath("/admin/usuarios");
  });
}

const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2, "Informe o nome."),
  role: z.enum(["admin", "user"]),
  active: z.boolean(),
  password: z.string().optional(),
});

export async function updateUser(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const me = await requireAdmin();
  return run(async () => {
    const data = parse(updateSchema, input);
    if (data.id === me.id && (data.role !== "admin" || !data.active)) {
      throw new UserError("Você não pode remover seu próprio acesso de administrador.");
    }
    if (data.password && data.password.length < 8) {
      throw new UserError("A senha deve ter pelo menos 8 caracteres.");
    }
    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(data.id, {
      ban_duration: data.active ? "none" : "876000h",
      ...(data.password ? { password: data.password } : {}),
      user_metadata: { name: data.name },
    });
    if (error) throw new UserError(`Não foi possível atualizar o usuário: ${error.message}`);
    await db
      .update(profiles)
      .set({ name: data.name, role: data.role, active: data.active })
      .where(eq(profiles.id, data.id));
    revalidatePath("/admin/usuarios");
  });
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  return run(async () => {
    if (id === me.id) throw new UserError("Você não pode excluir o próprio usuário.");
    const { error } = await createAdminClient().auth.admin.deleteUser(id);
    if (error) throw new UserError(`Não foi possível excluir o usuário: ${error.message}`);
    // O perfil é removido em cascata junto com auth.users.
    revalidatePath("/admin/usuarios");
  });
}

/** Publica a empresa: gera um novo link secreto de acompanhamento (somente leitura). */
export async function publishCompany(id: string): Promise<ActionResult<{ token: string }>> {
  await requireAdmin();
  return run(async () => {
    const token = newPublicToken();
    const updated = await db
      .update(companies)
      .set({ publicToken: token, publishedAt: new Date() })
      .where(eq(companies.id, id))
      .returning({ id: companies.id });
    if (updated.length === 0) throw new UserError("Empresa não encontrada.");
    revalidatePath("/admin/empresas");
    return { token };
  });
}

/** Torna a empresa privada: o link deixa de funcionar imediatamente. */
export async function unpublishCompany(id: string): Promise<ActionResult> {
  await requireAdmin();
  return run(async () => {
    await db.update(companies).set({ publicToken: null, publishedAt: null }).where(eq(companies.id, id));
    revalidatePath("/admin/empresas");
  });
}
