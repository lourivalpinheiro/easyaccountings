"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { ConfirmAction } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCnpj } from "@/lib/accounting";
import { toastResult } from "@/lib/toast-result";
import { deleteCompany, saveCompany } from "../actions";

type Company = { id: string; legalName: string; cnpj: string };

export function CompaniesClient({ companies }: { companies: Company[] }) {
  const [editing, setEditing] = useState<Partial<Company> | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const ok = toastResult(
        await saveCompany({
          id: editing?.id,
          legalName: String(fd.get("legalName")),
          cnpj: String(fd.get("cnpj")),
        }),
        editing?.id ? "Empresa atualizada." : "Empresa cadastrada com plano de contas padrão.",
      );
      if (ok) setEditing(null);
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex justify-end">
          <Button onClick={() => setEditing({})}>
            <Plus /> Nova empresa
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão social</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Nenhuma empresa cadastrada.
                </TableCell>
              </TableRow>
            )}
            {companies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.legalName}</TableCell>
                <TableCell>{formatCnpj(c.cnpj)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(c)}>
                    <Pencil />
                  </Button>
                  <ConfirmAction
                    title="Excluir empresa?"
                    description={`Todos os dados contábeis de "${c.legalName}" serão excluídos permanentemente.`}
                    onConfirm={async () => toastResult(await deleteCompany(c.id), "Empresa excluída.")}
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
              <DialogTitle>{editing?.id ? "Editar empresa" : "Nova empresa"}</DialogTitle>
              {!editing?.id && (
                <DialogDescription>
                  A empresa será criada com natureza das contas, categorias de DRE e plano de contas padrão.
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="legalName">Razão social</Label>
              <Input id="legalName" name="legalName" defaultValue={editing?.legalName} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                name="cnpj"
                defaultValue={editing?.cnpj ? formatCnpj(editing.cnpj) : ""}
                placeholder="00.000.000/0000-00"
                required
              />
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
