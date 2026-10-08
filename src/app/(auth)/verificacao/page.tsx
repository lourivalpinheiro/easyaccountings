import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPasswordSession } from "@/lib/auth/session";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

export default async function VerifyPage() {
  const session = await getPasswordSession();
  if (!session) redirect("/login");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Verificação em duas etapas</CardTitle>
        <CardDescription>
          Enviamos um código de 6 dígitos para {maskEmail(session.email)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyForm />
      </CardContent>
    </Card>
  );
}
