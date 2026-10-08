"use client";

import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ConfirmAction } from "@/components/confirm-button";
import { TablePagination, usePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toastResult } from "@/lib/toast-result";
import { deleteHistoryCode, deleteHistoryCodes, saveHistoryCode } from "../actions";

type Row = { id: string; code: number; description: string };

export function HistoryCodesClient({ rows }: { rows: Row[] }) {
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.description.toLowerCase().includes(q) || String(r.code).includes(q)) : rows;
  }, [rows, query]);
  const { rows: pageRows, pagination } = usePagination(filtered);
  const nextCode = rows.reduce((m, r) => Math.max(m, r.code), 0) + 1;

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(pageRows.map((r) => r.id)) : new Set());
  }

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar histórico..." className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button onClick={() => setEditing({ code: nextCode })}>
            <Plus /> Novo histórico
          </Button>
        </div>
        <BulkDeleteBar count={selected.size} onConfirm={() => deleteHistoryCodes([...selected])} onDone={() => setSelected(new Set())} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                  onCheckedChange={(v) => toggleAll(v === true)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {rows.length === 0 ? "Nenhum histórico cadastrado." : "Nenhum histórico encontrado."}
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => toggleRow(r.id, v === true)} aria-label={`Selecionar histórico ${r.code}`} />
                </TableCell>
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
<TablePagination {...pagination} />
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
