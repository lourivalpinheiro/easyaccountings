import "server-only";
import { requireUser } from "@/lib/auth/session";
import { getActiveCompany } from "@/lib/company";

/** Usuário e empresa ativa para páginas do módulo contábil. */
export async function getPageContext() {
  const [user, company] = await Promise.all([requireUser(), getActiveCompany()]);
  return { user, company };
}
