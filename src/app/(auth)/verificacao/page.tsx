import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getPasswordSession } from "@/lib/auth/session";
import { SetupTotpForm } from "./setup-totp-form";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function VerifyPage() {
  const session = await getPasswordSession();
  if (!session) redirect("/login");
  const [profile] = await db.select({ totpSecret: profiles.totpSecret }).from(profiles).where(eq(profiles.id, session.userId));

  if (!profile?.totpSecret) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Configure o aplicativo autenticador</CardTitle>
          <CardDescription>
            Escaneie o QR code com o Google Authenticator, Authy, 1Password ou outro aplicativo compatível com TOTP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupTotpForm />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Verificação em duas etapas</CardTitle>
        <CardDescription>Digite o código de 6 dígitos do seu aplicativo autenticador.</CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyForm />
      </CardContent>
    </Card>
  );
}
