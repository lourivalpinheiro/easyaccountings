"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { missingEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { getPasswordSession } from "./session";
import { TWO_FACTOR_COOKIE, twoFactorCookieValue } from "./two-factor-cookie";

export type FormState = { error?: string; success?: string } | undefined;

/** Depois de verificar o código, o navegador fica dispensado do 2FA por 7 dias. */
const TWO_FACTOR_REMEMBER_SECONDS = 60 * 60 * 24 * 7;
/** Segredo TOTP gerado mas ainda não confirmado pelo usuário. */
const PENDING_TOTP_COOKIE = "ea_totp_setup";
const PENDING_TOTP_TTL_SECONDS = 10 * 60;

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const missing = missingEnv();
  if (missing.length > 0) {
    console.error(`[login] Variáveis de ambiente ausentes: ${missing.join(", ")}`);
    return { error: "O servidor não está configurado corretamente. Avise o administrador do sistema." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.session) return { error: "E-mail ou senha inválidos." };

    const [profile] = await db.select({ active: profiles.active }).from(profiles).where(eq(profiles.id, data.user.id));
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      return { error: "Usuário sem acesso ao sistema. Procure um administrador." };
    }
  } catch (e) {
    console.error("[login] Erro inesperado:", e);
    return { error: "Erro no servidor ao entrar. Tente novamente em instantes." };
  }
  redirect("/verificacao");
}

/** Gera um novo segredo TOTP e guarda num cookie temporário até o usuário confirmar o primeiro código. */
export async function startTotpSetup(): Promise<{ secret: string; qrDataUrl: string }> {
  const session = await getPasswordSession();
  if (!session) redirect("/login");
  const secret = generateTotpSecret();
  const cookieStore = await cookies();
  cookieStore.set(PENDING_TOTP_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_TOTP_TTL_SECONDS,
  });
  const qrDataUrl = await QRCode.toDataURL(totpUri(secret, session.email), { width: 220, margin: 1 });
  return { secret, qrDataUrl };
}

export async function confirmTotpSetup(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getPasswordSession();
  if (!session) redirect("/login");
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { error: "Informe o código de 6 dígitos." };

  const cookieStore = await cookies();
  const secret = cookieStore.get(PENDING_TOTP_COOKIE)?.value;
  if (!secret) return { error: "A configuração expirou. Recomece." };
  if (!verifyTotp(secret, code)) return { error: "Código inválido." };

  await db.update(profiles).set({ totpSecret: secret }).where(eq(profiles.id, session.userId));
  cookieStore.delete(PENDING_TOTP_COOKIE);
  cookieStore.set(TWO_FACTOR_COOKIE, twoFactorCookieValue(session.sessionId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TWO_FACTOR_REMEMBER_SECONDS,
  });
  redirect("/");
}

export async function verifyCode(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getPasswordSession();
  if (!session) redirect("/login");
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { error: "Informe o código de 6 dígitos." };

  const [profile] = await db.select({ totpSecret: profiles.totpSecret }).from(profiles).where(eq(profiles.id, session.userId));
  if (!profile?.totpSecret) redirect("/verificacao");
  if (!verifyTotp(profile.totpSecret, code)) return { error: "Código inválido." };

  const cookieStore = await cookies();
  cookieStore.set(TWO_FACTOR_COOKIE, twoFactorCookieValue(session.sessionId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TWO_FACTOR_REMEMBER_SECONDS,
  });
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(TWO_FACTOR_COOKIE);
  cookieStore.delete(PENDING_TOTP_COOKIE);
  redirect("/login");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${process.env.SITE_URL}/auth/callback?next=/redefinir-senha`,
  });
  // Mesma resposta exista ou não a conta, para não revelar e-mails cadastrados.
  return {
    success: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
  };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem." });

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Link expirado ou inválido. Solicite uma nova recuperação." };
  await supabase.auth.signOut();
  redirect("/login?senha=redefinida");
}
