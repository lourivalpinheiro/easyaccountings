import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { UsersClient } from "./users-client";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email, role: profiles.role, active: profiles.active })
    .from(profiles)
    .orderBy(asc(profiles.name));
  return (
    <>
      <PageHeader
        title="Usuários"
        description="Somente administradores criam contas. O acesso exige senha e código enviado por e-mail."
      />
      <UsersClient users={users} currentUserId={me.id} />
    </>
  );
}
