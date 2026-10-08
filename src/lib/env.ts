import "server-only";

const REQUIRED = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "AUTH_2FA_SECRET", "SITE_URL", "MAIL_FROM"];

/** Nomes (nunca valores) das variáveis de ambiente obrigatórias que estão ausentes. */
export function missingEnv() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) missing.push("RESEND_API_KEY ou SMTP_HOST");
  return missing;
}
