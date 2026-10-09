"use client";

import { Globe, Link2, ListChecks, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState, useTransition } from "react";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ConfirmAction } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { TablePagination, usePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PUBLIC_SECTIONS } from "@/lib/public-sections";
import { toastResult } from "@/lib/toast-result";
import { deleteCompanies, deleteCompany, publishCompany, saveCompany, unpublishCompany, updatePublicSections } from "../actions";
import { ActiveFilters, ColumnHead, useTableControls } from "@/components/column-head";
import type { Column } from "@/lib/table-controls";

const publicUrl = (token: string) => `${window.location.origin}/publico/${token}`;

async function copyLink(token: string) {
  try {
    await navigator.clipboard.writeText(publicUrl(token));
    toast.success("Link copiado.");
  } catch {
    toast.info(publicUrl(token));
  }
}

type Company = {
  id: string;
  personType: PersonType;
  legalName: string;
  displayName: string | null;
  document: string | null;
  publicToken: string | null;
  publicSections: string[] | null;
};

const COLUMNS: Column<Company>[] = [
  { id: "name", label: "Nome / Razão social", value: (c) => `${c.legalName} ${c.displayName ?? ""}` },
  {
    id: "type",
    label: "Tipo",
    type: "select",
    value: (c) => c.personType,
    options: (["PJ", "PF", "INF"] as const).map((t) => ({ value: t, label: PERSON_LABELS[t].type })),
  },
  { id: "document", label: "CPF / CNPJ", value: (c) => c.document },
  {
    id: "published",
    label: "Publicação",
    type: "select",
    value: (c) => (c.publicToken ? "sim" : "nao"),
    options: [
      { value: "sim", label: "Publicada" },
      { value: "nao", label: "Privada" },
    ],
    sortable: false,
  },
];

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
  const [configuring, setConfiguring] = useState<Company | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [configPending, startConfigTransition] = useTransition();
  const labels = PERSON_LABELS[personType];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.legalName.toLowerCase().includes(q) || c.displayName?.toLowerCase().includes(q) || c.document?.includes(q));
  }, [companies, query]);
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
    setSelected(checked ? new Set(pageRows.map((c) => c.id)) : new Set());
  }

  function openConfig(c: Company) {
    setConfiguring(c);
    setSections(c.publicSections ?? PUBLIC_SECTIONS.map((s) => s.slug));
  }

  function toggleSection(slug: string, checked: boolean) {
    setSections((prev) => (checked ? [...prev, slug] : prev.filter((s) => s !== slug)));
  }

  function saveConfig() {
    if (!configuring) return;
    startConfigTransition(async () => {
      const ok = toastResult(await updatePublicSections(configuring.id, sections), "Publicação configurada.");
      if (ok) setConfiguring(null);
    });
  }

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
        await saveCompany({
          id: editing?.id,
          personType,
          legalName: String(fd.get("legalName")),
          displayName: String(fd.get("displayName") ?? ""),
          document,
        }),
        editing?.id ? "Empresa atualizada." : "Empresa cadastrada com plano de contas padrão.",
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
            <Input placeholder="Buscar empresa..." className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button onClick={() => open({})}>
            <Plus /> Nova empresa
          </Button>
        </div>
        <BulkDeleteBar
          count={selected.size}
          onConfirm={() => deleteCompanies([...selected])}
          onDone={() => setSelected(new Set())}
        />
        <ActiveFilters controls={table.controls} />
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
              <ColumnHead controls={table.controls} id="name" />
              <ColumnHead controls={table.controls} id="type" className="hidden w-36 md:table-cell" />
              <ColumnHead controls={table.controls} id="document" className="hidden sm:table-cell" />
              <ColumnHead controls={table.controls} id="published" className="w-24 text-right">
                Ações
              </ColumnHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {companies.length === 0 ? "Nenhuma empresa cadastrada." : "Nenhuma empresa encontrada."}
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => toggleRow(c.id, v === true)} aria-label={`Selecionar ${c.legalName}`} />
                </TableCell>
                <TableCell className="font-medium">
                  {c.legalName}
                  {c.publicToken && (
                    <Badge variant="outline" className="ml-2 border-primary text-primary">
                      <Globe /> Publicada
                    </Badge>
                  )}
                  {c.displayName && <div className="text-xs font-normal text-muted-foreground">{c.displayName}</div>}
                  <div className="text-xs font-normal text-muted-foreground tabular-nums sm:hidden">{formatDocument(c.personType, c.document)}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant={c.personType === "PJ" ? "default" : c.personType === "PF" ? "secondary" : "outline"}>{PERSON_LABELS[c.personType].type}</Badge>
                </TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{formatDocument(c.personType, c.document) || "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {c.publicToken ? (
                    <>
                      <Button variant="ghost" size="icon" aria-label="Copiar link público" title="Copiar link público" onClick={() => copyLink(c.publicToken!)}>
                        <Link2 className="text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Configurar publicação" title="Configurar o que aparece no link público" onClick={() => openConfig(c)}>
                        <ListChecks />
                      </Button>
                      <ConfirmAction
                        title="Tornar empresa privada?"
                        description="O link público deixará de funcionar imediatamente. Se publicar de novo, um link diferente será gerado."
                        confirmLabel="Tornar privada"
                        onConfirm={async () => toastResult(await unpublishCompany(c.id), "Empresa privada; o link foi desativado.")}
                      >
                        <Button variant="ghost" size="icon" aria-label="Tornar privada" title="Tornar privada">
                          <Lock />
                        </Button>
                      </ConfirmAction>
                    </>
                  ) : (
                    <ConfirmAction
                      title="Publicar empresa?"
                      description="Será gerado um link secreto. Quem tiver o link poderá ver o painel e os relatórios desta empresa, sem login e sem poder fazer lançamentos."
                      confirmLabel="Publicar"
                      onConfirm={async () => {
                        const result = await publishCompany(c.id);
                        if (toastResult(result, "Empresa publicada.") && result.ok) await copyLink(result.data!.token);
                      }}
                    >
                      <Button variant="ghost" size="icon" aria-label="Publicar" title="Publicar (gerar link de acompanhamento)">
                        <Globe />
                      </Button>
                    </ConfirmAction>
                  )}
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
            {personType !== "INF" && (
              <div className="grid gap-2">
                <Label htmlFor="displayName">{labels.displayName} (opcional)</Label>
                <Input id="displayName" name="displayName" defaultValue={editing?.displayName ?? ""} maxLength={120} />
              </div>
            )}
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

      <Dialog open={configuring !== null} onOpenChange={(o) => !o && setConfiguring(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar publicação</DialogTitle>
            <DialogDescription>
              Escolha quais relatórios aparecem no link público de &quot;{configuring?.legalName}&quot;. O painel sempre aparece.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {PUBLIC_SECTIONS.map((s) => (
              <label key={s.slug} className="flex items-center gap-2 text-sm">
                <Checkbox checked={sections.includes(s.slug)} onCheckedChange={(v) => toggleSection(s.slug, v === true)} />
                {s.title}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfiguring(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={configPending} onClick={saveConfig}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
