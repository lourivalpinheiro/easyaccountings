"use server";

import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { mfaChallenges, profiles } from "@/db/schema";
import { missingEnv } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";
import { getPasswordSession } from "./session";
import { TWO_FACTOR_COOKIE, twoFactorCookieValue } from "./two-factor-cookie";

export type FormState = { error?: string; success?: string } | undefined;

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return createHash("sha256").update(`${code}:${process.env.AUTH_2FA_SECRET}`).digest("hex");
}

async function issueChallenge(userId: string, sessionId: string, email: string) {
  await db
    .update(mfaChallenges)
    .set({ usedAt: new Date() })
    .where(and(eq(mfaChallenges.sessionId, sessionId), isNull(mfaChallenges.usedAt)));

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.insert(mfaChallenges).values({
    userId,
    sessionId,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  await sendMail(
    email,
    "Seu código de acesso - Easy Accountings",
    `<p>Seu código de verificação é:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>Ele expira em 10 minutos. Se não foi você, ignore este e-mail e troque sua senha.</p>`,
    `Seu código de verificação é ${code}. Ele expira em 10 minutos.`,
  );
}

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

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, data.user.id));
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      return { error: "Usuário sem acesso ao sistema. Procure um administrador." };
    }

    const { data: claimsData } = await supabase.auth.getClaims(data.session.access_token);
    const sessionId = claimsData?.claims.session_id as string;
    try {
      await issueChallenge(profile.id, sessionId, profile.email);
    } catch (e) {
      console.error("[login] Falha ao enviar o código de verificação:", e);
      await supabase.auth.signOut();
      return { error: "Não foi possível enviar o código de verificação. Tente novamente." };
    }
  } catch (e) {
    console.error("[login] Erro inesperado:", e);
    return { error: "Erro no servidor ao entrar. Tente novamente em instantes." };
  }
  redirect("/verificacao");
}

export async function verifyCode(_: FormState, formData: FormData): Promise<FormState> {
  const session = await getPasswordSession();
  if (!session) redirect("/login");
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return { error: "Informe o código de 6 dígitos." };

  const [challenge] = await db
    .select()
    .from(mfaChallenges)
    .where(and(eq(mfaChallenges.sessionId, session.sessionId), isNull(mfaChallenges.usedAt)))
    .orderBy(desc(mfaChallenges.createdAt))
    .limit(1);

  if (!challenge || challenge.expiresAt < new Date()) {
    return { error: "Código expirado. Solicite um novo código." };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { error: "Muitas tentativas. Solicite um novo código." };
  }
  if (challenge.codeHash !== hashCode(code)) {
    await db
      .update(mfaChallenges)
      .set({ attempts: challenge.attempts + 1 })
      .where(eq(mfaChallenges.id, challenge.id));
    return { error: "Código inválido." };
  }

  await db.update(mfaChallenges).set({ usedAt: new Date() }).where(eq(mfaChallenges.id, challenge.id));
  const cookieStore = await cookies();
  cookieStore.set(TWO_FACTOR_COOKIE, twoFactorCookieValue(session.sessionId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  redirect("/");
}

export async function resendCode(): Promise<FormState> {
  const session = await getPasswordSession();
  if (!session) redirect("/login");
  const [last] = await db
    .select()
    .from(mfaChallenges)
    .where(eq(mfaChallenges.sessionId, session.sessionId))
    .orderBy(desc(mfaChallenges.createdAt))
    .limit(1);
  if (last && Date.now() - last.createdAt.getTime() < 60_000) {
    return { error: "Aguarde um minuto antes de solicitar outro código." };
  }
  await issueChallenge(session.userId, session.sessionId, session.email);
  return { success: "Enviamos um novo código para o seu e-mail." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(TWO_FACTOR_COOKIE);
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
