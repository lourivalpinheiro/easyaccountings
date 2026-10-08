"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { ConfirmAction } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toastResult } from "@/lib/toast-result";
import { deleteHistoryCode, saveHistoryCode } from "../actions";

type Row = { id: string; code: number; description: string };

export function HistoryCodesClient({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [pending, startTransition] = useTransition();
  const nextCode = rows.reduce((m, r) => Math.max(m, r.code), 0) + 1;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const ok = toastResult(
        await saveHistoryCode({ id: editing?.id, code: Number(fd.get("code")), description: String(fd.get("description")) }),
        "Histórico salvo.",
      );
      if (ok) setEditing(null);
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex justify-end">
          <Button onClick={() => setEditing({ code: nextCode })}>
            <Plus /> Novo histórico
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Nenhum histórico cadastrado.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{r.code}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(r)}>
                    <Pencil />
                  </Button>
                  <ConfirmAction
                    title="Excluir histórico?"
                    description={`O histórico ${r.code} será removido.`}
                    onConfirm={async () => toastResult(await deleteHistoryCode(r.id), "Histórico excluído.")}
                  >
                    <Button variant="ghost" size="icon" aria-label="Excluir">
                      <Trash2 className="text-destructive" />
                    </Button>
                  </ConfirmAction>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar histórico" : "Novo histórico"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="code">Código</Label>
              <Input id="code" name="code" type="number" min={1} defaultValue={editing?.code} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Input id="description" name="description" defaultValue={editing?.description} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
