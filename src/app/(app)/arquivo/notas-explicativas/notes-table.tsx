"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { ConfirmAction } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toastResult } from "@/lib/toast-result";
import { deleteNote } from "../actions";

type Note = {
  id: string;
  number: number;
  title: string;
  updatedAt: string;
  accountClassification: string | null;
  accountName: string | null;
};

export function NotesTable({ notes }: { notes: Note[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Nota</TableHead>
          <TableHead>Título</TableHead>
          <TableHead>Conta vinculada</TableHead>
          <TableHead className="w-44">Atualizada em</TableHead>
          <TableHead className="w-24 text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notes.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              Nenhuma nota explicativa cadastrada.
            </TableCell>
          </TableRow>
        )}
        {notes.map((n) => (
          <TableRow key={n.id}>
            <TableCell className="tabular-nums">{n.number}</TableCell>
            <TableCell className="font-medium">{n.title}</TableCell>
            <TableCell>
              {n.accountName ? (
                `${n.accountClassification} - ${n.accountName}`
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>{new Date(n.updatedAt).toLocaleString("pt-BR")}</TableCell>
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
  );
}
