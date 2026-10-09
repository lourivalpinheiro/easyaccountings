"use client";

import { Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ConfirmAction } from "@/components/confirm-button";
import { TablePagination, usePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTimeBrasilia } from "@/lib/accounting";
import { toastResult } from "@/lib/toast-result";
import { deleteNote, deleteNotes } from "../actions";
import { ActiveFilters, ColumnHead, useTableControls } from "@/components/column-head";
import type { Column } from "@/lib/table-controls";

type Note = {
  id: string;
  number: number;
  title: string;
  updatedAt: string;
  accountClassification: string | null;
  accountName: string | null;
};

const COLUMNS: Column<Note>[] = [
  { id: "number", label: "Nota", type: "number", value: (n) => n.number },
  { id: "title", label: "Título", value: (n) => n.title },
  {
    id: "account",
    label: "Conta vinculada",
    value: (n) => (n.accountName ? `${n.accountClassification} - ${n.accountName}` : null),
  },
  { id: "updatedAt", label: "Atualizada em", type: "date", value: (n) => n.updatedAt },
];

export function NotesTable({ notes }: { notes: Note[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.title.toLowerCase().includes(q) || String(n.number).includes(q)) : notes;
  }, [notes, query]);
  const table = useTableControls(filtered, COLUMNS);
  const { rows: pageRows, pagination } = usePagination(table.rows);

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(pageRows.map((n) => n.id)) : new Set());
  }

  return (
    <div className="grid gap-4">
      <div className="relative w-full sm:w-64">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar nota..." className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <BulkDeleteBar count={selected.size} onConfirm={() => deleteNotes([...selected])} onDone={() => setSelected(new Set())} />
    <ActiveFilters controls={table.controls} />
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={pageRows.length > 0 && pageRows.every((n) => selected.has(n.id))}
              onCheckedChange={(v) => toggleAll(v === true)}
              aria-label="Selecionar todos"
            />
          </TableHead>
          <ColumnHead controls={table.controls} id="number" className="w-20" />
          <ColumnHead controls={table.controls} id="title" />
          <ColumnHead controls={table.controls} id="account" className="hidden md:table-cell" />
          <ColumnHead controls={table.controls} id="updatedAt" className="hidden w-44 lg:table-cell" />
          <TableHead className="w-24 text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              {notes.length === 0 ? "Nenhuma nota explicativa cadastrada." : "Nenhuma nota encontrada."}
            </TableCell>
          </TableRow>
        )}
        {pageRows.map((n) => (
          <TableRow key={n.id}>
            <TableCell>
              <Checkbox checked={selected.has(n.id)} onCheckedChange={(v) => toggleRow(n.id, v === true)} aria-label={`Selecionar nota ${n.number}`} />
            </TableCell>
            <TableCell className="tabular-nums">{n.number}</TableCell>
            <TableCell className="font-medium">{n.title}</TableCell>
            <TableCell className="hidden md:table-cell">
              {n.accountName ? (
                `${n.accountClassification} - ${n.accountName}`
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="hidden lg:table-cell">{formatDateTimeBrasilia(n.updatedAt)}</TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" aria-label="Editar" asChild>
                <Link href={`/arquivo/notas-explicativas/${n.id}`}>
                  <Pencil />
                </Link>
              </Button>
              <ConfirmAction
                title="Excluir nota explicativa?"
                description={`Nota ${n.number} - ${n.title}`}
                onConfirm={async () => toastResult(await deleteNote(n.id), "Nota excluída.")}
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
    </div>
  );
}
