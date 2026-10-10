"use client";

import { AlertTriangle, Search, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { ConfirmAction } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastResult } from "@/lib/toast-result";
import { countRemovable, removeEntries } from "./actions";

type Module = "contabil" | "financeiro";

const MODULE_LABELS: Record<Module, string> = { contabil: "Contábil (lançamentos)", financeiro: "Financeiro (movimentações)" };

type Preview = { contabil: number; contabilProtected: number; financeiro: number };

export function RemocaoClient({ isAdmin }: { isAdmin: boolean }) {
  const [modules, setModules] = useState<Set<Module>>(new Set());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleModule = (m: Module, checked: boolean) => {
    setPreview(null);
    setModules((prev) => {
      const next = new Set(prev);
      if (checked) next.add(m);
      else next.delete(m);
      return next;
    });
  };

  const input = { modules: [...modules], from: from || undefined, to: to || undefined };

  function consultar() {
    startTransition(async () => {
      const result = await countRemovable(input);
      if (toastResult(result) && result.ok) setPreview(result.data!);
    });
  }

  function remover() {
    startTransition(async () => {
      const result = await removeEntries(input);
      if (toastResult(result)) {
        setPreview(null);
        setModules(new Set());
      }
    });
  }

  const totalToRemove = (preview?.contabil ?? 0) + (preview?.financeiro ?? 0);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Excluir lançamentos em massa</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label>Módulos</Label>
          {(["contabil", "financeiro"] as Module[]).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <Checkbox checked={modules.has(m)} onCheckedChange={(v) => toggleModule(m, v === true)} disabled={!isAdmin} />
              {MODULE_LABELS[m]}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="rm-from">De (opcional)</Label>
            <Input
              id="rm-from"
              type="date"
              value={from}
              disabled={!isAdmin}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreview(null);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rm-to">Até (opcional)</Label>
            <Input
              id="rm-to"
              type="date"
              value={to}
              disabled={!isAdmin}
              onChange={(e) => {
                setTo(e.target.value);
                setPreview(null);
              }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Sem datas, remove de todo o período. Lançamentos de zeramento nunca são excluídos por aqui — só pelo próprio
          utilitário de zeramento. Datas no período já fechado não podem ser excluídas.
        </p>
        {preview && (
          <div className="grid gap-1 rounded-md border bg-muted/40 p-3 text-sm">
            {modules.has("contabil") && (
              <p>
                <span className="font-semibold">{preview.contabil}</span> lançamento(s) contábil(eis)
                {preview.contabilProtected > 0 && ` (${preview.contabilProtected} de zeramento serão mantidos)`}
              </p>
            )}
            {modules.has("financeiro") && (
              <p>
                <span className="font-semibold">{preview.financeiro}</span> movimentação(ões) financeira(s)
              </p>
            )}
            {totalToRemove === 0 && <p className="text-muted-foreground">Nada encontrado com esses filtros.</p>}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={!isAdmin || pending || modules.size === 0} onClick={consultar}>
          <Search /> Consultar
        </Button>
        <ConfirmAction
          title="Excluir lançamentos permanentemente?"
          description={`Serão excluídos ${totalToRemove} registro(s). Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir definitivamente"
          onConfirm={async () => remover()}
        >
          <Button type="button" variant="destructive" disabled={!isAdmin || pending || !preview || totalToRemove === 0}>
            <Trash2 /> Excluir
          </Button>
        </ConfirmAction>
      </CardFooter>
      {!isAdmin && (
        <CardContent className="pt-0">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5" /> Só administradores podem excluir lançamentos em massa.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
