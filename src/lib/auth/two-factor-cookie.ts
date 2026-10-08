import { createHmac, timingSafeEqual } from "node:crypto";

export const TWO_FACTOR_COOKIE = "ea_2fa";

function sign(sessionId: string) {
  return createHmac("sha256", process.env.AUTH_2FA_SECRET!).update(sessionId).digest("base64url");
}

/** Valor do cookie que comprova que a sessão `sessionId` passou pelo segundo fator. */
export function twoFactorCookieValue(sessionId: string) {
  return `${sessionId}.${sign(sessionId)}`;
}

export function isTwoFactorCookieValid(value: string | undefined, sessionId: string | undefined) {
  if (!value || !sessionId) return false;
  const expected = Buffer.from(twoFactorCookieValue(sessionId));
  const actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** A sessão precisa ter sido criada com senha (não por link de recuperação/OTP). */
export function hasPasswordAmr(amr: unknown) {
  if (!Array.isArray(amr)) return false;
  return amr.some((e) => (typeof e === "string" ? e : e?.method) === "password");
}
