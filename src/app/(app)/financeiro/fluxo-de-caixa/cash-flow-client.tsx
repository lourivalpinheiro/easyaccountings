"use client";

import { ArrowDownCircle, ArrowUpCircle, FileText, Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { TablePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate, formatMoney } from "@/lib/accounting";
import { todayIso } from "@/lib/period";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";
import { deleteCashFlowEntries, deleteCashFlowEntry, saveCashFlowEntry } from "../actions";

type FlowType = "entrada" | "saida";
type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number; isPublic: boolean };
type Entry = {
  id: string;
  date: string;
  type: FlowType;
  description: string;
  category: string | null;
  cents: number;
  attachments: Attachment[];
};
type Draft = { id?: string; date: string; type: FlowType; description: string; category: string; cents: number };

const ALL = "todos";

export function CashFlowClient({
  period,
  filters,
  paging,
  summary,
  categories,
  entries,
}: {
  period: { from: string; to: string };
  filters: { q: string; type: string };
  paging: { page: number; pageSize: number; total: number };
  summary: { previous: number; inflow: number; outflow: number };
  categories: string[];
  entries: Entry[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [q, setQ] = useState(filters.q);
  const [type, setType] = useState(filters.type || ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const final = summary.previous + summary.inflow - summary.outflow;

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(entries.map((e) => e.id)) : new Set());
  }

  const go = (changes: { pagina?: number; por?: number } = {}) => {
    const p = new URLSearchParams({
      de: from,
      ate: to,
      pagina: String(changes.pagina ?? 1),
      por: String(changes.por ?? paging.pageSize),
    });
    if (q.trim()) p.set("q", q.trim());
    if (type !== ALL) p.set("tipo", type);
    router.push(`?${p.toString()}`);
  };

  const open = (type: FlowType) =>
    setDraft({ date: todayIso(), type, description: "", category: "", cents: 0 });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    startTransition(async () => {
      const ok = toastResult(
        await saveCashFlowEntry(draft),
        draft.id ? "Registro atualizado." : draft.type === "entrada" ? "Entrada registrada." : "Saída registrada.",
      );
      if (ok) setDraft(null);
    });
  }

  const cards = [
    { label: "Saldo anterior", value: summary.previous, icon: Wallet, signed: true },
    { label: "Entradas", value: summary.inflow, icon: ArrowUpCircle, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Saídas", value: summary.outflow, icon: ArrowDownCircle, tone: "text-destructive" },
    { label: "Saldo final", value: final, icon: Wallet, signed: true },
  ];

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="gap-1 py-3 sm:py-4">
            <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-4">
              <CardDescription>{c.label}</CardDescription>
              <c.icon className={cn("size-4", c.tone ?? "text-primary")} />
            </CardHeader>
            <CardContent className="px-3 sm:px-4">
              <div
                className={cn(
                  "text-base font-semibold tabular-nums sm:text-xl",
                  c.tone,
                  c.signed && c.value < 0 && "text-destructive",
                )}
              >
                {c.signed && c.value < 0 ? "-" : ""}
                {formatMoney(Math.abs(c.value))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button onClick={() => open("entrada")} className="bg-emerald-600 text-white hover:bg-emerald-600/90">
          <Plus /> Nova entrada
        </Button>
        <Button onClick={() => open("saida")} variant="destructive">
          <Plus /> Nova saída
        </Button>
        <Button variant="outline" className="col-span-2 sm:ml-auto" asChild>
          <Link href={`/financeiro/relatorio?de=${period.from}&ate=${period.to}`}>
            <FileText /> Emitir relatório
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimentações</CardTitle>
          <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:flex-wrap sm:items-end">
            <Input
              className="col-span-2 sm:w-56"
              placeholder="Buscar descrição ou categoria"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go()}
            />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="col-span-2 w-full sm:w-36" aria-label="Tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
            <Input type="date" className="sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
            <Button variant="outline" className="col-span-2 sm:col-span-1" onClick={() => go()}>
              <Search /> Buscar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <BulkDeleteBar
            count={selected.size}
            onConfirm={() => deleteCashFlowEntries([...selected])}
            onDone={() => setSelected(new Set())}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={entries.length > 0 && entries.every((e) => selected.has(e.id))}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead className="w-24">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma movimentação entre {formatDate(period.from)} e {formatDate(period.to)}.
                  </TableCell>
                </TableRow>
              )}
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(e.id)} onCheckedChange={(v) => toggleRow(e.id, v === true)} aria-label={`Selecionar ${e.description}`} />
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(e.date)}</TableCell>
                  <TableCell className="max-w-40 sm:max-w-none">
                    <div className="truncate">{e.description}</div>
                    {e.category && <div className="truncate text-xs text-muted-foreground md:hidden">{e.category}</div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{e.category ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium whitespace-nowrap tabular-nums",
                      e.type === "entrada" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                    )}
                  >
                    {e.type === "entrada" ? "+" : "-"} {formatMoney(e.cents)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => setDraft({ ...e, category: e.category ?? "" })}
                    >
                      <Pencil />
                    </Button>
                    <ConfirmAction
                      title="Excluir movimentação?"
                      description={`${formatDate(e.date)} - ${e.description} (${formatMoney(e.cents)})`}
                      onConfirm={async () => toastResult(await deleteCashFlowEntry(e.id), "Movimentação excluída.")}
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
          <TablePagination
            page={paging.page}
            pageSize={paging.pageSize}
            total={paging.total}
            onPageChange={(pagina) => go({ pagina })}
            onPageSizeChange={(por) => go({ por })}
          />
        </CardContent>
      </Card>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          {draft && (
            <form onSubmit={submit} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar movimentação" : draft.type === "entrada" ? "Nova entrada" : "Nova saída"}</DialogTitle>
              </DialogHeader>
              <ToggleGroup
                type="single"
                variant="outline"
                value={draft.type}
                onValueChange={(v) => v && setDraft({ ...draft, type: v as FlowType })}
                className="w-full"
              >
                <ToggleGroupItem value="entrada" className="flex-1 data-[state=on]:text-emerald-600">
                  <ArrowUpCircle /> Entrada
                </ToggleGroupItem>
                <ToggleGroupItem value="saida" className="flex-1 data-[state=on]:text-destructive">
                  <ArrowDownCircle /> Saída
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="cf-date">Data</Label>
                  <Input id="cf-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cf-value">Valor</Label>
                  <MoneyInput id="cf-value" value={draft.cents} onChange={(cents) => setDraft({ ...draft, cents })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cf-desc">Descrição</Label>
                <Input
                  id="cf-desc"
                  value={draft.description}
                  maxLength={200}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cf-cat">Categoria (opcional)</Label>
                <Input
                  id="cf-cat"
                  list="cf-categories"
                  value={draft.category}
                  maxLength={80}
                  placeholder="Ex.: Vendas, Aluguel, Fornecedores"
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
                <datalist id="cf-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <AttachmentsPanel
                entryType="movimentacao"
                entryId={draft.id}
                attachments={entries.find((e) => e.id === draft.id)?.attachments ?? []}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending || draft.cents <= 0}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
