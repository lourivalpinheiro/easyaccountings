import "server-only";
import { requireUser } from "@/lib/auth/session";
import { getActiveCompany } from "@/lib/company";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export class UserError extends Error {}

/** Garante usuário autenticado e empresa ativa; converte erros em mensagens. */
export async function companyAction<T>(
  fn: (ctx: { companyId: string; userId: string }) => Promise<T>,
): Promise<ActionResult<T>> {
  const user = await requireUser();
  const company = await getActiveCompany();
  if (!company) return { ok: false, error: "Selecione uma empresa." };
  return run(() => fn({ companyId: company.id, userId: user.id }));
}

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    const code = (e as { code?: string; cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code;
    if (code === "23505") return { ok: false, error: "Já existe um registro com esses dados." };
    if (code === "23503") return { ok: false, error: "Registro em uso por outros dados; não pode ser alterado/excluído." };
    console.error(e);
    return { ok: false, error: "Erro inesperado. Tente novamente." };
  }
}
