import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { profiles, userCompanies } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { listCompanies } from "@/lib/company";
import { UsersClient } from "./users-client";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const [users, companies, grants] = await Promise.all([
    db
      .select({ id: profiles.id, name: profiles.name, email: profiles.email, role: profiles.role, active: profiles.active, totpSecret: profiles.totpSecret })
      .from(profiles)
      .orderBy(asc(profiles.name)),
    listCompanies(),
    db.select({ userId: userCompanies.userId, companyId: userCompanies.companyId }).from(userCompanies),
  ]);
  const accessByUser = new Map<string, string[]>();
  for (const g of grants) accessByUser.set(g.userId, [...(accessByUser.get(g.userId) ?? []), g.companyId]);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Somente administradores criam contas. O acesso exige senha e um aplicativo autenticador (TOTP)."
      />
      <UsersClient
        users={users.map((u) => ({ ...u, hasTotp: Boolean(u.totpSecret), companyIds: accessByUser.get(u.id) ?? [] }))}
        companies={companies.map((c) => ({ id: c.id, legalName: c.legalName }))}
        currentUserId={me.id}
      />
    </>
  );
}
