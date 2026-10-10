"use client";

import { BarChart3, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AccountPicker, AccountQuickCreate, type PickerAccount } from "@/components/account-picker";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { TablePagination, usePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/accounting";
import { todayIso, yearStartIso } from "@/lib/period";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";
import { deleteBudget, deleteBudgets, saveBudget } from "./actions";
import { ActiveFilters, ColumnHead, useTableControls } from "@/components/column-head";
import type { Column } from "@/lib/table-controls";

type Item = { accountId: string | null; cents: number };
type Budget = { id?: string; name: string; startDate: string; endDate: string; totalCents: number; items: Item[] };

const COLUMNS: Column<Budget>[] = [
  { id: "name", label: "Orçamento", value: (b) => b.name },
  { id: "period", label: "Período", type: "date", value: (b) => b.startDate },
  { id: "accounts", label: "Contas", type: "number", value: (b) => b.items.length },
  { id: "total", label: "Valor total", type: "money", value: (b) => b.totalCents },
];

export function BudgetsClient({ budgets, accounts }: { budgets: Budget[]; accounts: PickerAccount[] }) {
  const [draft, setDraft] = useState<Budget | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? budgets.filter((b) => b.name.toLowerCase().includes(q)) : budgets;
  }, [budgets, query]);
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
    setSelected(checked ? new Set(pageRows.map((b) => b.id!)) : new Set());
  }

  const itemsTotal = draft?.items.reduce((s, i) => s + i.cents, 0) ?? 0;
  const diff = (draft?.totalCents ?? 0) - itemsTotal;
  const setItem = (index: number, patch: Partial<Item>) =>
    setDraft((d) => d && { ...d, items: d.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (draft.items.some((i) => !i.accountId)) {
      toastResult({ ok: false, error: "Selecione a conta de todas as linhas." });
      return;
    }
    startTransition(async () => {
      const ok = toastResult(
        await saveBudget({ ...draft, items: draft.items.map((i) => ({ accountId: i.accountId!, cents: i.cents })) }),
        "Orçamento salvo.",
      );
      if (ok) setDraft(null);
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar orçamento..." className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button
            onClick={() =>
              setDraft({
                name: "",
                startDate: yearStartIso(),
                endDate: `${todayIso().slice(0, 4)}-12-31`,
                totalCents: 0,
                items: [{ accountId: null, cents: 0 }],
              })
            }
          >
            <Plus /> Novo orçamento
          </Button>
        </div>
        <BulkDeleteBar count={selected.size} onConfirm={() => deleteBudgets([...selected])} onDone={() => setSelected(new Set())} />
        <ActiveFilters controls={table.controls} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={pageRows.length > 0 && pageRows.every((b) => selected.has(b.id!))}
                  onCheckedChange={(v) => toggleAll(v === true)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <ColumnHead controls={table.controls} id="name" />
              <ColumnHead controls={table.controls} id="period" className="hidden sm:table-cell" />
              <ColumnHead controls={table.controls} id="accounts" className="hidden text-right md:table-cell" />
              <ColumnHead controls={table.controls} id="total" className="text-right" />
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {budgets.length === 0 ? "Nenhum orçamento cadastrado." : "Nenhum orçamento encontrado."}
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Checkbox checked={selected.has(b.id!)} onCheckedChange={(v) => toggleRow(b.id!, v === true)} aria-label={`Selecionar ${b.name}`} />
                </TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatDate(b.startDate)} a {formatDate(b.endDate)}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{b.items.length}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(b.totalCents)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label="Orçado x realizado" asChild>
                    <Link href={`/financeiro/orcado-x-realizado?orcamento=${b.id}`}>
                      <BarChart3 />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setDraft(b)}>
                    <Pencil />
                  </Button>
                  <ConfirmAction
                    title="Excluir orçamento?"
                    description={b.name}
                    onConfirm={async () => toastResult(await deleteBudget(b.id!), "Orçamento excluído.")}
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

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-3xl">
          {draft && (
            <form onSubmit={submit} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_9.5rem_9.5rem_10rem]">
                <div className="col-span-2 grid gap-2 md:col-span-1">
                  <Label htmlFor="b-name">Nome</Label>
                  <Input id="b-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="b-start">Início</Label>
                  <Input id="b-start" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="b-end">Fim</Label>
                  <Input id="b-end" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} required />
                </div>
                <div className="col-span-2 grid gap-2 md:col-span-1">
                  <Label htmlFor="b-total">Valor total</Label>
                  <MoneyInput id="b-total" value={draft.totalCents} onChange={(totalCents) => setDraft({ ...draft, totalCents })} />
                </div>
              </div>
              <div className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1">
                <Label>Contas orçadas</Label>
                {draft.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] gap-2 border-b pb-2 sm:grid-cols-[1fr_10rem_auto] sm:border-0 sm:pb-0">
                    <AccountPicker className="col-span-2 sm:col-span-1" accounts={accounts} value={item.accountId} onChange={(accountId) => setItem(i, { accountId })} />
                    <MoneyInput value={item.cents} onChange={(cents) => setItem(i, { cents })} aria-label="Valor orçado" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover conta"
                      disabled={draft.items.length === 1}
                      onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDraft({ ...draft, items: [...draft.items, { accountId: null, cents: 0 }] })}
                  >
                    <Plus /> Adicionar conta
                  </Button>
                  <AccountQuickCreate
                    accounts={accounts}
                    onCreated={(accountId) => setDraft((d) => d && { ...d, items: [...d.items, { accountId, cents: 0 }] })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-6 text-sm tabular-nums">
                <span>
                  Soma das contas: <strong>{formatMoney(itemsTotal)}</strong>
                </span>
                <span className={cn(diff !== 0 && "text-destructive")}>
                  Diferença para o total: <strong>{formatMoney(diff)}</strong>
                </span>
                {diff !== 0 && (
                  <button type="button" className="text-primary hover:underline" onClick={() => setDraft({ ...draft, totalCents: itemsTotal })}>
                    Usar a soma como total
                  </button>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending || diff !== 0}>
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
