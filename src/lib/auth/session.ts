import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  TWO_FACTOR_COOKIE,
  hasPasswordAmr,
  isTwoFactorCookieValid,
} from "./two-factor-cookie";

export type SessionUser = typeof profiles.$inferSelect & { sessionId: string };

/** Usuário autenticado com senha (ainda sem considerar o segundo fator). */
export const getPasswordSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || !hasPasswordAmr(claims.amr)) return null;
  return {
    userId: claims.sub,
    email: claims.email as string,
    sessionId: claims.session_id as string,
  };
});

/** Usuário totalmente autenticado (senha + código por e-mail) e ativo. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getPasswordSession();
  if (!session) return null;
  const cookieStore = await cookies();
  if (!isTwoFactorCookieValid(cookieStore.get(TWO_FACTOR_COOKIE)?.value, session.sessionId)) {
    return null;
  }
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, session.userId));
  if (!profile || !profile.active) return null;
  return { ...profile, sessionId: session.sessionId };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
