import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { AVATARS_BUCKET, publicUrl } from "@/lib/storage";
import { ProfileClient } from "./profile-client";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Meu perfil" description="Seus dados de acesso ao sistema." />
      <ProfileClient
        name={user.name}
        email={user.email}
        role={user.role}
        avatarUrl={user.avatarPath ? publicUrl(AVATARS_BUCKET, user.avatarPath) : null}
      />
    </>
  );
}
