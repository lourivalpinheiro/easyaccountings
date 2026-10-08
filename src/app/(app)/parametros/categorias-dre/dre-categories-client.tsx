"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ConfirmAction } from "@/components/confirm-button";
import { TablePagination, usePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toastResult } from "@/lib/toast-result";
import { deleteDreCategories, deleteDreCategory, reorderDreCategories, saveDreCategory } from "../actions";

type Category = { id: string; name: string; position: number; accounts: number };

export function DreCategoriesClient({ categories }: { categories: Category[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const { rows: pageRows, pagination } = usePagination(categories);

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(pageRows.map((c) => c.id)) : new Set());
  }

  const move = (index: number, delta: number) => {
    const ids = categories.map((c) => c.id);
    const [item] = ids.splice(index, 1);
    ids.splice(index + delta, 0, item);
    startTransition(async () => void toastResult(await reorderDreCategories(ids)));
  };

  return (
    <Card>
      <CardContent className="grid gap-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const ok = toastResult(
                await saveDreCategory({ name: newName, position: categories.length + 1 }),
                "Categoria criada.",
              );
              if (ok) setNewName("");
            });
          }}
        >
          <Input placeholder="Nova categoria (ex.: DESPESAS FIXAS)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button type="submit" disabled={pending || !newName.trim()}>
            <Plus /> Adicionar
          </Button>
        </form>
        <BulkDeleteBar count={selected.size} onConfirm={() => deleteDreCategories([...selected])} onDone={() => setSelected(new Set())} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={pageRows.length > 0 && pageRows.every((c) => selected.has(c.id))}
                  onCheckedChange={(v) => toggleAll(v === true)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead className="w-16">Ordem</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="w-32 text-right">Contas</TableHead>
              <TableHead className="w-44 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma categoria cadastrada.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((c) => {
              const i = categories.indexOf(c);
              return (
              <TableRow key={c.id}>
                <TableCell>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => toggleRow(c.id, v === true)} aria-label={`Selecionar ${c.name}`} />
                </TableCell>
                <TableCell className="tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">
                  {editingId === c.id ? (
                    <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                  ) : (
                    c.name
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.accounts}</TableCell>
                <TableCell className="text-right">
                  {editingId === c.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Salvar"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            if (toastResult(await saveDreCategory({ id: c.id, name, position: c.position }))) setEditingId(null);
                          })
                        }
                      >
                        <Check />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Cancelar" onClick={() => setEditingId(null)}>
                        <X />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" aria-label="Subir" disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Descer"
                        disabled={i === categories.length - 1 || pending}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        onClick={() => {
                          setEditingId(c.id);
                          setName(c.name);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <ConfirmAction
                        title="Excluir categoria?"
                        description={
                          c.accounts > 0
                            ? `${c.accounts} conta(s) ficarão sem categoria de DRE.`
                            : "A categoria será removida."
                        }
                        onConfirm={async () => toastResult(await deleteDreCategory(c.id), "Categoria excluída.")}
                      >
                        <Button variant="ghost" size="icon" aria-label="Excluir">
                          <Trash2 className="text-destructive" />
                        </Button>
                      </ConfirmAction>
                    </>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination {...pagination} />
      </CardContent>
    </Card>
  );
}
