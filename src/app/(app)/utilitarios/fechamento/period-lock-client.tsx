"use client";

import { Lock, Unlock } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/accounting";
import { setPeriodLock } from "@/lib/reconciliation-actions";
import { toastResult } from "@/lib/toast-result";

export function PeriodLockClient({ lockedUntil, isAdmin }: { lockedUntil: string | null; isAdmin: boolean }) {
  const [date, setDate] = useState(lockedUntil ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Bloquear lançamentos até</CardTitle>
        <CardDescription>
          {lockedUntil
            ? `Período fechado até ${formatDate(lockedUntil)}. Lançamentos nessa data ou antes são recusados, no contábil e no financeiro.`
            : "Nenhum bloqueio ativo no momento."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Label htmlFor="lock-date">Data limite</Label>
        <Input id="lock-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!isAdmin} />
        {!isAdmin && <p className="text-xs text-muted-foreground">Só administradores podem alterar o fechamento de período.</p>}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {lockedUntil && (
          <Button
            type="button"
            variant="outline"
            disabled={!isAdmin || pending}
            onClick={() => startTransition(async () => void toastResult(await setPeriodLock(null), "Bloqueio removido."))}
          >
            <Unlock /> Remover bloqueio
          </Button>
        )}
        <Button
          type="button"
          disabled={!isAdmin || pending || !date}
          onClick={() => startTransition(async () => void toastResult(await setPeriodLock(date), "Período fechado."))}
        >
          <Lock /> Fechar período
        </Button>
      </CardFooter>
    </Card>
  );
}
