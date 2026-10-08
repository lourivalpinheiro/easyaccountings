import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  redefinida: "Senha redefinida. Entre com a nova senha.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const notice = typeof params.senha === "string" ? NOTICES[params.senha] : undefined;
  const linkError = params.link === "invalido";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Acessar o sistema</CardTitle>
        <CardDescription>
          {linkError
            ? "O link utilizado é inválido ou expirou."
            : "Entre com seu e-mail e senha. Contas são criadas por um administrador."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm notice={notice} />
      </CardContent>
    </Card>
  );
}
