"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { ConfirmAction } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { TablePagination, usePagination } from "@/components/pagination";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDocument, PERSON_LABELS, type PersonType } from "@/lib/accounting";
import { toastResult } from "@/lib/toast-result";
import { deleteCompany, saveCompany } from "../actions";

type Company = { id: string; personType: PersonType; legalName: string; document: string | null };

/** Aplica a máscara de CPF ou CNPJ enquanto o usuário digita. */
function maskDocument(personType: PersonType, value: string) {
  // [posição do dígito, separador inserido antes dele]
  if (personType === "INF") return "";
  const pattern: [number, string][] =
    personType === "PF"
      ? [[3, "."], [6, "."], [9, "-"]]
      : [[2, "."], [5, "."], [8, "/"], [12, "-"]];
  const digits = value.replace(/\D/g, "").slice(0, personType === "PF" ? 11 : 14);
  let out = "";
  for (const [i, ch] of [...digits].entries()) {
    out += (pattern.find(([pos]) => pos === i)?.[1] ?? "") + ch;
  }
  return out;
}

export function CompaniesClient({ companies }: { companies: Company[] }) {
  const [editing, setEditing] = useState<Partial<Company> | null>(null);
  const [personType, setPersonType] = useState<PersonType>("PJ");
  const [document, setDocument] = useState("");
  const [pending, startTransition] = useTransition();
  const labels = PERSON_LABELS[personType];
  const { rows: pageRows, pagination } = usePagination(companies);

  function open(company: Partial<Company>) {
    const type = company.personType ?? "PJ";
    setEditing(company);
    setPersonType(type);
    setDocument(company.document ? formatDocument(type, company.document) : "");
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const ok = toastResult(
        await saveCompany({ id: editing?.id, personType, legalName: String(fd.get("legalName")), document }),
        editing?.id ? "Empresa atualizada." : "Empresa cadastrada com plano de contas padrão.",
      );
      if (ok) setEditing(null);
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex justify-end">
          <Button onClick={() => open({})}>
            <Plus /> Nova empresa
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Razão social</TableHead>
              <TableHead className="hidden w-36 md:table-cell">Tipo</TableHead>
              <TableHead className="hidden sm:table-cell">CPF / CNPJ</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhuma empresa cadastrada.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.legalName}
                  <div className="text-xs font-normal text-muted-foreground tabular-nums sm:hidden">{formatDocument(c.personType, c.document)}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant={c.personType === "PJ" ? "default" : c.personType === "PF" ? "secondary" : "outline"}>{PERSON_LABELS[c.personType].type}</Badge>
                </TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{formatDocument(c.personType, c.document) || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => open(c)}>
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
<TablePagination {...pagination} />
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
              <Label>Tipo de pessoa</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={personType}
                onValueChange={(v) => {
                  if (!v) return;
                  setPersonType(v as PersonType);
                  setDocument((d) => maskDocument(v as PersonType, d));
                }}
                className="w-full"
              >
                <ToggleGroupItem value="PJ" className="flex-1">
                  Pessoa Jurídica
                </ToggleGroupItem>
                <ToggleGroupItem value="PF" className="flex-1">
                  Pessoa Física
                </ToggleGroupItem>
                <ToggleGroupItem value="INF" className="flex-1">
                  Informal
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="legalName">{labels.name}</Label>
              <Input id="legalName" name="legalName" defaultValue={editing?.legalName} required />
            </div>
            {personType === "INF" ? (
              <p className="text-sm text-muted-foreground">Empresas informais não precisam de CPF ou CNPJ.</p>
            ) : (
            <div className="grid gap-2">
              <Label htmlFor="document">{labels.document}</Label>
              <Input
                id="document"
                inputMode="numeric"
                value={document}
                onChange={(e) => setDocument(maskDocument(personType, e.target.value))}
                placeholder={personType === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
                className="tabular-nums"
                required
              />
            </div>
            )}
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
