import "server-only";

const REQUIRED = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "AUTH_2FA_SECRET", "SITE_URL"];

/** Nomes (nunca valores) das variáveis de ambiente obrigatórias que estão ausentes. */
export function missingEnv() {
  return REQUIRED.filter((name) => !process.env[name]);
}
