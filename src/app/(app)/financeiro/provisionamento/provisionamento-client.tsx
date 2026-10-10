"use client";

import { ArrowDownCircle, ArrowUpCircle, Check, FileText, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AccountPicker, AccountQuickCreate, type PickerAccount } from "@/components/account-picker";
import { ActiveFilters, ColumnHead, useUrlTableControls } from "@/components/column-head";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { PeriodPicker } from "@/components/period-presets";
import { TablePagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
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
import type { Filters, SortState } from "@/lib/table-controls";
import { cn } from "@/lib/utils";
import { deleteProvision, deleteProvisions, saveProvision, settleProvision, unsettleProvision } from "./actions";
import { PROVISION_COLUMNS } from "./columns";

type ProvisionType = "pagar" | "receber";

const TYPE_LABELS: Record<ProvisionType, { singular: string; plural: string }> = {
  pagar: { singular: "A pagar", plural: "Contas a pagar" },
  receber: { singular: "A receber", plural: "Contas a receber" },
};

const TYPE_STYLE: Record<ProvisionType, { icon: typeof ArrowUpCircle; tone: string; on: string; button: string }> = {
  receber: {
    icon: ArrowUpCircle,
    tone: "text-emerald-600 dark:text-emerald-400",
    on: "data-[state=on]:text-emerald-600",
    button: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  },
  pagar: {
    icon: ArrowDownCircle,
    tone: "text-destructive",
    on: "data-[state=on]:text-destructive",
    button: "bg-destructive text-white hover:bg-destructive/90",
  },
};

type Provision = {
  id: string;
  type: ProvisionType;
  description: string;
  category: string | null;
  dueDate: string;
  cents: number;
  settledAt: string | null;
  cashFlowEntryId: string | null;
  journalEntryId: string | null;
  journalEntryNumber: number | null;
};
type Draft = { id?: string; type: ProvisionType; description: string; category: string; dueDate: string; cents: number };
type SettleDraft = {
  id: string;
  type: ProvisionType;
  date: string;
  description: string;
  cents: number;
  debitAccountId: string | null;
  creditAccountId: string | null;
  historyCode: string;
  category: string;
};

const NO_HISTORY = "nenhum";

export function ProvisionamentoClient({
  period,
  query,
  table,
  paging,
  categories,
  accounts,
  histories,
  provisions,
}: {
  period: { from: string; to: string };
  query: string;
  table: { sort: SortState; filters: Filters };
  paging: { page: number; pageSize: number; total: number };
  categories: string[];
  accounts: PickerAccount[];
  histories: { code: number; description: string }[];
  provisions: Provision[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [settling, setSettling] = useState<SettleDraft | null>(null);
  const [q, setQ] = useState(query);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const controls = useUrlTableControls(PROVISION_COLUMNS, table, {
    category: categories.map((c) => ({ value: c, label: c })),
  });

  const pendingRows = provisions.filter((p) => !p.settledAt);
  const totals = {
    pagar: pendingRows.filter((p) => p.type === "pagar").reduce((s, p) => s + p.cents, 0),
    receber: pendingRows.filter((p) => p.type === "receber").reduce((s, p) => s + p.cents, 0),
  };

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const go = (changes: { pagina?: number; por?: number; de?: string; ate?: string } = {}) => {
    const p = new URLSearchParams(window.location.search);
    p.set("de", changes.de ?? period.from);
    p.set("ate", changes.ate ?? period.to);
    p.set("pagina", String(changes.pagina ?? 1));
    p.set("por", String(changes.por ?? paging.pageSize));
    if (q.trim()) p.set("q", q.trim());
    else p.delete("q");
    router.push(`?${p.toString()}`);
  };

  const open = (type: ProvisionType) => setDraft({ type, description: "", category: "", dueDate: todayIso(), cents: 0 });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    startTransition(async () => {
      const ok = toastResult(await saveProvision(draft), draft.id ? "Registro atualizado." : "Registro cadastrado.");
      if (ok) setDraft(null);
    });
  }

  const openSettle = (p: Provision) =>
    setSettling({
      id: p.id,
      type: p.type,
      date: todayIso(),
      description: p.description,
      cents: p.cents,
      debitAccountId: null,
      creditAccountId: null,
      historyCode: "",
      category: p.category ?? "",
    });

  function submitSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!settling || !settling.debitAccountId || !settling.creditAccountId) return;
    startTransition(async () => {
      const ok = toastResult(
        await settleProvision({
          id: settling.id,
          date: settling.date,
          debitAccountId: settling.debitAccountId!,
          creditAccountId: settling.creditAccountId!,
          historyCode: settling.historyCode ? Number(settling.historyCode) : null,
          category: settling.category,
        }),
        "Conta baixada.",
      );
      if (ok) setSettling(null);
    });
  }

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-1 py-3 sm:py-4">
          <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-4">
            <CardDescription>{TYPE_LABELS.pagar.plural} pendentes</CardDescription>
            <ArrowDownCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent className="px-3 text-base font-semibold tabular-nums text-destructive sm:px-4 sm:text-xl">
            {formatMoney(totals.pagar)}
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:py-4">
          <CardHeader className="flex flex-row items-center justify-between px-3 sm:px-4">
            <CardDescription>{TYPE_LABELS.receber.plural} pendentes</CardDescription>
            <ArrowUpCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="px-3 text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 sm:px-4 sm:text-xl">
            {formatMoney(totals.receber)}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => open("pagar")}>
          <Plus /> Novo lançamento
        </Button>
        <Button variant="outline" className="sm:ml-auto" asChild>
          <Link href={`/financeiro/provisionamento/relatorio?de=${period.from}&ate=${period.to}`}>
            <FileText /> Emitir relatório
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contas a pagar e a receber</CardTitle>
          <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:flex-wrap sm:items-end">
            <Input
              className="col-span-2 sm:w-56"
              placeholder="Buscar descrição ou categoria"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go()}
            />
            <PeriodPicker className="col-span-2" value={period} onChange={(p) => go({ de: p.from, ate: p.to })} />
            <Button variant="outline" className="col-span-2 sm:col-span-1" onClick={() => go()}>
              <Search /> Buscar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <BulkDeleteBar
            count={selected.size}
            onConfirm={() => deleteProvisions([...selected])}
            onDone={() => setSelected(new Set())}
          />
          <ActiveFilters controls={controls} />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pendingRows.length > 0 && pendingRows.every((p) => selected.has(p.id))}
                      onCheckedChange={(v) =>
                        setSelected(v === true ? new Set(pendingRows.map((p) => p.id)) : new Set())
                      }
                      aria-label="Selecionar todas as pendentes"
                    />
                  </TableHead>
                  <ColumnHead controls={controls} id="dueDate" className="w-24" />
                  <ColumnHead controls={controls} id="description" />
                  <ColumnHead controls={controls} id="type" className="hidden lg:table-cell" />
                  <ColumnHead controls={controls} id="category" className="hidden md:table-cell" />
                  <ColumnHead controls={controls} id="amount" className="text-right" />
                  <ColumnHead controls={controls} id="status" />
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provisions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhuma conta com vencimento entre {formatDate(period.from)} e {formatDate(period.to)}.
                    </TableCell>
                  </TableRow>
                )}
                {provisions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {!p.settledAt && (
                        <Checkbox checked={selected.has(p.id)} onCheckedChange={(v) => toggleRow(p.id, v === true)} aria-label={`Selecionar ${p.description}`} />
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatDate(p.dueDate)}</TableCell>
                    <TableCell className="max-w-40 sm:max-w-none">
                      <span className="truncate">{p.description}</span>
                      <div className={cn("text-xs lg:hidden", TYPE_STYLE[p.type].tone)}>{TYPE_LABELS[p.type].singular}</div>
                      {p.category && <div className="truncate text-xs text-muted-foreground md:hidden">{p.category}</div>}
                    </TableCell>
                    <TableCell className={cn("hidden lg:table-cell", TYPE_STYLE[p.type].tone)}>{TYPE_LABELS[p.type].singular}</TableCell>
                    <TableCell className="hidden md:table-cell">{p.category ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className={cn("text-right font-medium whitespace-nowrap tabular-nums", TYPE_STYLE[p.type].tone)}>
                      {formatMoney(p.cents)}
                    </TableCell>
                    <TableCell>
                      {p.settledAt ? (
                        <Badge variant="secondary">
                          <Check /> Baixado {formatDate(p.settledAt)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {p.settledAt ? (
                        <ConfirmAction
                          title="Estornar baixa?"
                          description="A movimentação do fluxo de caixa e o lançamento contábil gerados serão excluídos; a conta volta para pendente."
                          onConfirm={async () => toastResult(await unsettleProvision(p.id), "Baixa estornada.")}
                        >
                          <Button variant="ghost" size="icon" aria-label="Estornar baixa" title="Estornar baixa">
                            <RotateCcw />
                          </Button>
                        </ConfirmAction>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" aria-label="Dar baixa" title="Dar baixa" onClick={() => openSettle(p)}>
                            <Check />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar"
                            onClick={() => setDraft({ id: p.id, type: p.type, description: p.description, category: p.category ?? "", dueDate: p.dueDate, cents: p.cents })}
                          >
                            <Pencil />
                          </Button>
                          <ConfirmAction
                            title="Excluir registro?"
                            description={`${formatDate(p.dueDate)} - ${p.description} (${formatMoney(p.cents)})`}
                            onConfirm={async () => toastResult(await deleteProvision(p.id), "Registro excluído.")}
                          >
                            <Button variant="ghost" size="icon" aria-label="Excluir">
                              <Trash2 className="text-destructive" />
                            </Button>
                          </ConfirmAction>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
                <DialogTitle>{draft.id ? "Editar registro" : TYPE_LABELS[draft.type].singular === "A pagar" ? "Nova conta a pagar" : "Nova conta a receber"}</DialogTitle>
              </DialogHeader>
              {!draft.id && (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={draft.type}
                  onValueChange={(v) => v && setDraft({ ...draft, type: v as ProvisionType })}
                  className="grid w-full grid-cols-2"
                >
                  {(["pagar", "receber"] as ProvisionType[]).map((t) => {
                    const Icon = TYPE_STYLE[t].icon;
                    return (
                      <ToggleGroupItem key={t} value={t} className={cn("flex-1", TYPE_STYLE[t].on)}>
                        <Icon /> {TYPE_LABELS[t].singular}
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="pv-date">Vencimento</Label>
                  <Input id="pv-date" type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pv-value">Valor</Label>
                  <MoneyInput id="pv-value" value={draft.cents} onChange={(cents) => setDraft({ ...draft, cents })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pv-desc">Descrição</Label>
                <Input
                  id="pv-desc"
                  value={draft.description}
                  maxLength={200}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pv-cat">Categoria (opcional)</Label>
                <Input
                  id="pv-cat"
                  list="pv-categories"
                  value={draft.category}
                  maxLength={80}
                  placeholder="Ex.: Vendas, Aluguel, Fornecedores"
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
                <datalist id="pv-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
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

      <Dialog open={settling !== null} onOpenChange={(o) => !o && setSettling(null)}>
        <DialogContent className="no-scrollbar max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {settling && (
            <form onSubmit={submitSettle} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>Baixa de {settling.description}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[10rem_9rem_1fr]">
                <div className="grid gap-2">
                  <Label htmlFor="st-date">Data</Label>
                  <Input id="st-date" type="date" value={settling.date} onChange={(e) => setSettling({ ...settling, date: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="st-history">Histórico</Label>
                  <Select
                    value={settling.historyCode || NO_HISTORY}
                    onValueChange={(v) => setSettling({ ...settling, historyCode: v === NO_HISTORY ? "" : v })}
                  >
                    <SelectTrigger id="st-history" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value={NO_HISTORY}>Nenhum</SelectItem>
                      {histories.map((h) => (
                        <SelectItem key={h.code} value={String(h.code)}>
                          {h.code} - {h.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 grid gap-2 sm:col-span-1">
                  <Label htmlFor="st-cat">Categoria no fluxo de caixa</Label>
                  <Input
                    id="st-cat"
                    list="pv-categories"
                    value={settling.category}
                    maxLength={80}
                    onChange={(e) => setSettling({ ...settling, category: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="font-semibold">Conta débito</Label>
                <div className="flex gap-2">
                  <AccountPicker
                    accounts={accounts}
                    value={settling.debitAccountId}
                    onChange={(debitAccountId) => setSettling({ ...settling, debitAccountId })}
                    placeholder="Conta a débito"
                    className="min-w-0 flex-1"
                  />
                  <AccountQuickCreate accounts={accounts} onCreated={(debitAccountId) => setSettling({ ...settling, debitAccountId })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="font-semibold">Conta crédito</Label>
                <div className="flex gap-2">
                  <AccountPicker
                    accounts={accounts}
                    value={settling.creditAccountId}
                    onChange={(creditAccountId) => setSettling({ ...settling, creditAccountId })}
                    placeholder="Conta a crédito"
                    className="min-w-0 flex-1"
                  />
                  <AccountQuickCreate accounts={accounts} onCreated={(creditAccountId) => setSettling({ ...settling, creditAccountId })} />
                </div>
              </div>
              <div className="grid gap-2 sm:w-56">
                <Label className="font-semibold">Valor (R$)</Label>
                <MoneyInput value={settling.cents} disabled onChange={() => {}} />
              </div>
              <fieldset className="grid grid-cols-3 gap-2 rounded-md border px-3 pb-2 text-xs tabular-nums sm:text-sm">
                <legend className="px-1 text-xs text-muted-foreground">Status</legend>
                <div>
                  <span className="text-muted-foreground">Diferença: </span>
                  <span className="font-semibold text-primary">{formatMoney(0)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Débito: </span>
                  <span className="font-semibold">{formatMoney(settling.cents)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Crédito: </span>
                  <span className="font-semibold">{formatMoney(settling.cents)}</span>
                </div>
              </fieldset>
              <p className="text-xs text-muted-foreground">
                A baixa também lança {settling.type === "pagar" ? "uma saída" : "uma entrada"} no fluxo de caixa.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSettling(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending || !settling.debitAccountId || !settling.creditAccountId}>
                  OK
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
