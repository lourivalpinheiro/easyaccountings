"use client";

import { ArrowLeft, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth/actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Recuperar senha</CardTitle>
        <CardDescription>Informe seu e-mail para receber o link de redefinição.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
          <FormMessage state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Mail />}
            Enviar link
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/login">
              <ArrowLeft />
              Voltar ao login
            </Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
