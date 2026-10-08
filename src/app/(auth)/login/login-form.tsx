"use client";

import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/auth/actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(login, notice ? { success: notice } : undefined);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link href="/recuperar-senha" className="text-sm text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
        Entrar
      </Button>
    </form>
  );
}
