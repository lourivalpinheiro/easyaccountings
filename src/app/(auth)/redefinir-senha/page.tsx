"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth/actions";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Redefinir senha</CardTitle>
        <CardDescription>Escolha uma nova senha com pelo menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <FormMessage state={state} />
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Salvar nova senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
