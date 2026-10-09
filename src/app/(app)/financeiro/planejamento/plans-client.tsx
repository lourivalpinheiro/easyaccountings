"use client";

import { FileDown, History, Plus, Target, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmAction } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayIso } from "@/lib/period";
import { toastResult } from "@/lib/toast-result";
import { createPlan, deletePlan } from "./actions";

type Plan = { id: string; year: number; title: string; updatedAt: string; versions: number; lastVersion: number | null };

export function PlansClient({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const nextYear = plans.length ? Math.max(...plans.map((p) => p.year)) + 1 : Number(todayIso().slice(0, 4));
  const [draft, setDraft] = useState<{ year: number; title: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    startTransition(async () => {
      const result = await createPlan(draft);
      if (toastResult(result, "Plano criado.") && result.ok) {
        setDraft(null);
        router.push(`/financeiro/planejamento/${draft.year}/diagnostico`);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDraft({ year: nextYear, title: "" })}>
          <Plus /> Novo plano
        </Button>
      </div>
      {plans.length === 0 ? (
        <Card>
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <Target className="size-10 text-primary" />
            <p className="max-w-md text-sm text-muted-foreground">
              Nenhum plano ainda. Crie o plano do ano: ele já vem com um roteiro em cada seção (diagnóstico, planejamento,
              orçamentos, controle e cenários), com gráficos e indicadores calculados a partir do fluxo de caixa.
            </p>
            <Button onClick={() => setDraft({ year: nextYear, title: "" })}>
              <Plus /> Criar plano de {nextYear}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="gap-2">
              <CardHeader>
                <CardDescription className="text-2xl font-semibold text-primary tabular-nums">{p.year}</CardDescription>
                <CardTitle>
                  <Link href={`/financeiro/planejamento/${p.year}/diagnostico`} className="hover:underline">
                    {p.title}
                  </Link>
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <History className="size-3.5" />
                  {p.versions === 0 ? "Nenhuma versão salva" : `${p.versions} versão(ões) salva(s)`} · atualizado em{" "}
                  {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                </CardDescription>
              </CardHeader>
              <CardFooter className="gap-2">
                <Button asChild size="sm">
                  <Link href={`/financeiro/planejamento/${p.year}/diagnostico`}>Abrir</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`/financeiro/planejamento/${p.year}/pdf`} target="_blank" rel="noreferrer">
                    <FileDown /> PDF
                  </a>
                </Button>
                <ConfirmAction
                  title={`Excluir o plano de ${p.year}?`}
                  description="O texto, o orçamento, as metas, os cenários e todas as versões salvas serão excluídos."
                  onConfirm={async () => toastResult(await deletePlan(p.id), "Plano excluído.")}
                >
                  <Button size="icon" variant="ghost" className="ml-auto" aria-label="Excluir plano">
                    <Trash2 className="text-destructive" />
                  </Button>
                </ConfirmAction>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          {draft && (
            <form onSubmit={submit} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>Novo plano financeiro</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-[7rem_1fr] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="plan-year">Ano</Label>
                  <Input
                    id="plan-year"
                    type="number"
                    min={2000}
                    max={2100}
                    value={draft.year}
                    onChange={(e) => setDraft({ ...draft, year: Math.floor(Number(e.target.value)) || nextYear })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plan-title">Título</Label>
                  <Input
                    id="plan-title"
                    value={draft.title}
                    maxLength={160}
                    placeholder={`Planejamento financeiro ${draft.year}`}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O diagnóstico começa analisando o ano anterior (ou os últimos 12 meses, para um ano futuro); dá para mudar o
                período depois.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  Criar plano
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
