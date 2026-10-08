"use client";

import { Copy, CornerDownRight, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { AccountPicker } from "@/components/account-picker";
import { ConfirmDialog } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  GROUP_LABELS,
  isAnalytic,
  levelOf,
  MAX_LEVEL,
  parentOf,
  suggestChildClassification,
} from "@/lib/accounting";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";
import { saveDreCategory } from "../../parametros/actions";
import { deleteAccount, saveAccount } from "../actions";

type Account = {
  id: string;
  reducedCode: number;
  classification: string;
  name: string;
  level: number;
  analytic: boolean;
  group: keyof typeof GROUP_LABELS | null;
  nature: "D" | "C" | null;
  dreCategoryId: string | null;
  dreCategoryName: string | null;
};
type Category = { id: string; name: string };
type Draft = { id?: string; classification: string; name: string; dreCategoryId: string | null };

const NONE = "__none__";
const NEW = "__new__";

export function ChartClient({ chart, categories: initialCategories }: { chart: Account[]; categories: Category[] }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [categories, setCategories] = useState(initialCategories);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);
  const [pending, startTransition] = useTransition();
  const classifications = useMemo(() => chart.map((a) => a.classification), [chart]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chart;
    return chart.filter(
      (a) => a.name.toLowerCase().includes(q) || a.classification.startsWith(q) || String(a.reducedCode) === q,
    );
  }, [chart, query]);

  const openNew = (classification = "", dreCategoryId: string | null = null) => {
    setBaseId(null);
    setNewCategory(null);
    setDraft({ classification, name: "", dreCategoryId });
  };
  const childOf = (a: Account) => openNew(suggestChildClassification(a.classification, classifications));
  const siblingOf = (a: Account) =>
    openNew(suggestChildClassification(parentOf(a.classification), classifications), a.dreCategoryId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    startTransition(async () => {
      let dreCategoryId = draft.dreCategoryId;
      if (newCategory !== null) {
        const created = await saveDreCategory({ name: newCategory, position: categories.length + 1 });
        if (!toastResult(created)) return;
        const category = created.ok ? created.data! : null;
        if (category) {
          setCategories((c) => [...c, category]);
          dreCategoryId = category.id;
        }
        setNewCategory(null);
      }
      const ok = toastResult(await saveAccount({ ...draft, dreCategoryId }), draft.id ? "Conta atualizada." : "Conta criada.");
      if (ok) setDraft(null);
    });
  }

  const draftLevel = draft?.classification ? levelOf(draft.classification) : 0;
  const draftAnalytic = draft ? isAnalytic(draft.classification) : false;

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome, classificação ou código reduzido"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => openNew()}>
            <Plus /> Nova conta
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 text-right">Reduzido</TableHead>
                <TableHead className="w-32">Classificação</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
                <TableHead className="w-24">Natureza</TableHead>
                <TableHead>Categoria DRE</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhuma conta encontrada.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((a) => (
                <TableRow key={a.id} className={cn(!a.analytic && "bg-muted/40")}>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{a.reducedCode}</TableCell>
                  <TableCell className={cn("tabular-nums", !a.analytic && "font-semibold")}>{a.classification}</TableCell>
                  <TableCell className={cn(!a.analytic && "font-semibold")} style={{ paddingLeft: `${(a.level - 1) * 1.25 + 0.5}rem` }}>
                    {a.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.analytic ? "default" : "outline"}>{a.analytic ? "Analítica" : "Sintética"}</Badge>
                  </TableCell>
                  <TableCell>{a.nature === "D" ? "Devedora" : a.nature === "C" ? "Credora" : "—"}</TableCell>
                  <TableCell className="text-sm">{a.dreCategoryName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ações">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!a.analytic && (
                          <DropdownMenuItem onSelect={() => childOf(a)}>
                            <CornerDownRight /> Nova conta filha
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => siblingOf(a)}>
                          <Copy /> Nova a partir desta
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setNewCategory(null);
                            setDraft({ id: a.id, classification: a.classification, name: a.name, dreCategoryId: a.dreCategoryId });
                          }}
                        >
                          <Pencil /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(a)}>
                          <Trash2 /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir conta?"
        description={toDelete ? `${toDelete.classification} - ${toDelete.name}` : ""}
        onConfirm={async () => toDelete && toastResult(await deleteAccount(toDelete.id), "Conta excluída.")}
      />

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {draft && (
            <form onSubmit={submit} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar conta" : "Nova conta contábil"}</DialogTitle>
                <DialogDescription>
                  {draft.id
                    ? "Alterar a classificação de uma conta sintética reclassifica também as contas filhas."
                    : "Informe a classificação ou aproveite a de outra conta."}
                </DialogDescription>
              </DialogHeader>
              {!draft.id && (
                <div className="grid gap-2">
                  <Label>Aproveitar classificação de</Label>
                  <AccountPicker
                    accounts={chart.map((a) => ({ ...a, analytic: true }))}
                    value={baseId}
                    placeholder="Selecione uma conta como base (opcional)"
                    onChange={(id) => {
                      setBaseId(id);
                      const base = chart.find((a) => a.id === id);
                      if (!base) return;
                      setDraft((d) => d && {
                        ...d,
                        classification: base.analytic
                          ? suggestChildClassification(parentOf(base.classification), classifications)
                          : suggestChildClassification(base.classification, classifications),
                        dreCategoryId: d.dreCategoryId ?? base.dreCategoryId,
                      });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Base sintética sugere uma conta filha; base analítica sugere a próxima conta do mesmo grupo.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-[10rem_1fr] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="classification">Classificação</Label>
                  <Input
                    id="classification"
                    value={draft.classification}
                    onChange={(e) => setDraft({ ...draft, classification: e.target.value.replace(/[^\d.]/g, "") })}
                    placeholder="1.1.1.01"
                    className="tabular-nums"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Descrição</Label>
                  <Input id="name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                </div>
              </div>
              {draft.classification && (
                <p className="text-sm text-muted-foreground">
                  {draftLevel > MAX_LEVEL
                    ? `Máximo de ${MAX_LEVEL} graus.`
                    : `${draftLevel}º grau · ${draftAnalytic ? "Analítica (recebe lançamentos)" : "Sintética"}`}
                </p>
              )}
              <div className="grid gap-2">
                <Label>Categoria na DRE</Label>
                {newCategory === null ? (
                  <Select
                    value={draft.dreCategoryId ?? NONE}
                    onValueChange={(v) => {
                      if (v === NEW) setNewCategory("");
                      else setDraft({ ...draft, dreCategoryId: v === NONE ? null : v });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem categoria</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW}>+ Definir nova categoria...</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Nome da nova categoria"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      required
                    />
                    <Button type="button" variant="outline" onClick={() => setNewCategory(null)}>
                      Cancelar
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Usada pelas contas de resultado (despesas e receitas) na DRE.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
