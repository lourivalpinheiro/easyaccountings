"use client";

import { BarChart3, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { AccountPicker, type PickerAccount } from "@/components/account-picker";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { TablePagination, usePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/accounting";
import { todayIso, yearStartIso } from "@/lib/period";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";
import { deleteBudget, saveBudget } from "../actions";

type Item = { accountId: string | null; cents: number };
type Budget = { id?: string; name: string; startDate: string; endDate: string; totalCents: number; items: Item[] };

export function BudgetsClient({ budgets, accounts }: { budgets: Budget[]; accounts: PickerAccount[] }) {
  const [draft, setDraft] = useState<Budget | null>(null);
  const [pending, startTransition] = useTransition();
  const { rows: pageRows, pagination } = usePagination(budgets);

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
        <div className="flex justify-end">
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orçamento</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Contas</TableHead>
              <TableHead className="text-right">Valor total</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum orçamento cadastrado.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>
                  {formatDate(b.startDate)} a {formatDate(b.endDate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{b.items.length}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(b.totalCents)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label="Orçado x realizado" asChild>
                    <Link href={`/relatorios/orcamento?orcamento=${b.id}`}>
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
              <div className="grid gap-3 md:grid-cols-[1fr_9.5rem_9.5rem_10rem]">
                <div className="grid gap-2">
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
                <div className="grid gap-2">
                  <Label htmlFor="b-total">Valor total</Label>
                  <MoneyInput id="b-total" value={draft.totalCents} onChange={(totalCents) => setDraft({ ...draft, totalCents })} />
                </div>
              </div>
              <div className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1">
                <Label>Contas orçadas</Label>
                {draft.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_10rem_auto] gap-2">
                    <AccountPicker accounts={accounts} value={item.accountId} onChange={(accountId) => setItem(i, { accountId })} />
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => setDraft({ ...draft, items: [...draft.items, { accountId: null, cents: 0 }] })}
                >
                  <Plus /> Adicionar conta
                </Button>
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
