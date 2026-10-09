"use client";

import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AccountPicker, type PickerAccount } from "@/components/account-picker";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ActiveFilters, ColumnHead, useUrlTableControls } from "@/components/column-head";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { PeriodPresets } from "@/components/period-presets";
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/accounting";
import { todayIso } from "@/lib/period";
import { toastResult } from "@/lib/toast-result";
import type { Filters, SortState } from "@/lib/table-controls";
import { cn } from "@/lib/utils";
import { deleteEntries, deleteEntry, saveEntry } from "../actions";
import { ENTRY_COLUMNS } from "./columns";

type Line = { accountId: string; side: "D" | "C"; cents: number };
type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number; isPublic: boolean };
type Entry = {
  id: string;
  number: number;
  date: string;
  historyCode: number | null;
  description: string;
  closing: boolean;
  lines: Line[];
  attachments: Attachment[];
};
/** Partida: um valor com conta a débito, conta a crédito ou ambas (partida completa). */
type Partida = { debitAccountId: string | null; creditAccountId: string | null; cents: number };
type Draft = {
  id?: string;
  number?: number;
  date: string;
  historyCode: string;
  description: string;
  partidas: Partida[];
};

const emptyPartida = (): Partida => ({ debitAccountId: null, creditAccountId: null, cents: 0 });

function blankDraft(date = todayIso()): Draft {
  return { date, historyCode: "", description: "", partidas: [emptyPartida()] };
}

/** Débito seguido de crédito de mesmo valor vira uma partida completa; as demais linhas ficam em partidas de um lado só. */
function partidasFromLines(lines: Line[]): Partida[] {
  const partidas: Partida[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const next = lines[i + 1];
    if (l.side === "D" && next?.side === "C" && next.cents === l.cents) {
      partidas.push({ debitAccountId: l.accountId, creditAccountId: next.accountId, cents: l.cents });
      i++;
    } else if (l.side === "D") {
      partidas.push({ debitAccountId: l.accountId, creditAccountId: null, cents: l.cents });
    } else {
      partidas.push({ debitAccountId: null, creditAccountId: l.accountId, cents: l.cents });
    }
  }
  return partidas.length > 0 ? partidas : [emptyPartida()];
}

function linesFromPartidas(partidas: Partida[]): Line[] {
  return partidas.flatMap((p) => [
    ...(p.debitAccountId ? [{ accountId: p.debitAccountId, side: "D" as const, cents: p.cents }] : []),
    ...(p.creditAccountId ? [{ accountId: p.creditAccountId, side: "C" as const, cents: p.cents }] : []),
  ]);
}

function draftFromEntry(e: Entry): Draft {
  return {
    id: e.id,
    number: e.number,
    date: e.date,
    historyCode: e.historyCode ? String(e.historyCode) : "",
    description: e.description,
    partidas: partidasFromLines(e.lines),
  };
}

/** Lista pesquisável de históricos padrão, aberta logo abaixo do botão. */
function HistoryPicker({
  histories,
  onPick,
}: {
  histories: { code: number; description: string }[];
  onPick: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Escolher histórico padrão">
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)] p-0" align="start">
        <Command filter={(v, q) => (v.toLowerCase().includes(q.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar histórico..." />
          <CommandList>
            <CommandEmpty>Nenhum histórico encontrado.</CommandEmpty>
            <CommandGroup>
              {histories.map((h) => (
                <CommandItem
                  key={h.code}
                  value={`${h.code} ${h.description}`}
                  onSelect={() => {
                    onPick(String(h.code));
                    setOpen(false);
                  }}
                >
                  <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{h.code}</span>
                  <span className="truncate">{h.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const sum = (lines: Line[]) => lines.reduce((s, l) => s + l.cents, 0);

export function EntriesClient({
  period,
  query,
  table,
  paging,
  accounts,
  histories,
  entries,
}: {
  period: { from: string; to: string };
  query: string;
  table: { sort: SortState; filters: Filters };
  paging: { page: number; pageSize: number; total: number };
  accounts: PickerAccount[];
  histories: { code: number; description: string }[];
  entries: Entry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [initial, setInitial] = useState("");
  const [current, setCurrent] = useState(0);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [filter, setFilter] = useState(query);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const controls = useUrlTableControls(ENTRY_COLUMNS, table);

  function toggleBulkRow(id: string, checked: boolean) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleBulkAll(checked: boolean) {
    setBulkSelected(checked ? new Set(entries.filter((e) => !e.closing).map((e) => e.id)) : new Set());
  }

  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const readOnly = Boolean(selected?.closing);
  const accountLabel = useMemo(() => new Map(accounts.map((a) => [a.id, `${a.classification} - ${a.name}`])), [accounts]);

  const partida = draft.partidas[Math.min(current, draft.partidas.length - 1)];
  const lines = linesFromPartidas(draft.partidas);
  const totalD = sum(lines.filter((l) => l.side === "D"));
  const totalC = sum(lines.filter((l) => l.side === "C"));
  const diff = totalD - totalC;
  const dirty = JSON.stringify(draft) !== initial;

  const start = (d: Draft, id: string | null) => {
    setSelectedId(id);
    setDraft(d);
    setInitial(JSON.stringify(d));
    setCurrent(0);
    setOpen(true);
  };
  const openEntry = (e: Entry) => start(draftFromEntry(e), e.id);
  const openNew = () => start(blankDraft(), null);
  const close = () => setOpen(false);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setPartida = (patch: Partial<Partida>) =>
    setDraft((d) => ({ ...d, partidas: d.partidas.map((p, i) => (i === current ? { ...p, ...patch } : p)) }));

  const addPartida = () => {
    // A nova partida já sugere o valor que falta para fechar débitos e créditos.
    setDraft((d) => ({ ...d, partidas: [...d.partidas, { ...emptyPartida(), cents: Math.abs(diff) }] }));
    setCurrent(draft.partidas.length);
  };
  const removePartida = () => {
    setDraft((d) => ({ ...d, partidas: d.partidas.filter((_, i) => i !== current) }));
    setCurrent((c) => Math.max(0, Math.min(c, draft.partidas.length - 2)));
  };

  const setHistoryCode = (code: string) => {
    const h = histories.find((x) => String(x.code) === code);
    update({ historyCode: code, ...(h ? { description: h.description } : {}) });
  };

  /** OK grava as alterações (se houver) e fecha. */
  function confirm() {
    if (readOnly || !dirty) return close();
    startTransition(async () => {
      const result = await saveEntry({
        id: draft.id,
        date: draft.date,
        historyCode: draft.historyCode ? Number(draft.historyCode) : null,
        description: draft.description,
        lines,
      });
      if (toastResult(result, draft.id ? "Lançamento atualizado." : `Lançamento nº ${result.ok ? result.data?.number : ""} gravado.`)) {
        close();
      }
    });
  }

  const go = (changes: { pagina?: number; por?: number; de?: string; ate?: string; q?: string }) => {
    // Mantém ordenação e filtros de coluna já presentes na URL.
    const p = new URLSearchParams(window.location.search);
    p.set("de", changes.de ?? period.from);
    p.set("ate", changes.ate ?? period.to);
    p.set("pagina", String(changes.pagina ?? paging.page));
    p.set("por", String(changes.por ?? paging.pageSize));
    const q = changes.q ?? query;
    if (q) p.set("q", q);
    else p.delete("q");
    router.push(`?${p.toString()}`);
  };

  const total = draft.partidas.length;

  return (
    <div className="grid gap-6">
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="grid max-h-[90vh] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-3xl">
          <div className="grid gap-x-6 gap-y-1 border-b bg-muted/50 px-4 py-3 pr-12 text-sm sm:grid-cols-[auto_1fr_auto]">
            <div>
              <div className="text-xs font-semibold">Lançamento nº</div>
              <DialogTitle className="text-sm font-normal tabular-nums">{draft.number ?? "Novo"}</DialogTitle>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold">Descrição</div>
              <div className="truncate">{draft.description || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold">Data</div>
              <div className="tabular-nums">{draft.date ? formatDate(draft.date) : "—"}</div>
            </div>
          </div>

          {(!readOnly || total > 1) && (
            <div className="flex flex-wrap items-center gap-1 border-b px-3 py-1.5">
              {!readOnly && (
                <>
                  <Button type="button" variant="ghost" size="icon" onClick={addPartida} aria-label="Nova partida" title="Nova partida">
                    <Plus className="text-primary" />
                  </Button>
                  {total > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removePartida}
                      aria-label="Remover partida"
                      title="Remover partida"
                    >
                      <X className="text-destructive" />
                    </Button>
                  )}
                </>
              )}
              {total > 1 && (
                <>
                  {!readOnly && <span className="mx-1 h-5 w-px bg-border" />}
                  <Button type="button" variant="ghost" size="icon" disabled={current === 0} onClick={() => setCurrent(0)} aria-label="Primeira partida">
                    <ChevronFirst />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={current === 0}
                    onClick={() => setCurrent((c) => c - 1)}
                    aria-label="Partida anterior"
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="px-1 text-xs text-muted-foreground tabular-nums">
                    Partida {current + 1} de {total}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={current >= total - 1}
                    onClick={() => setCurrent((c) => c + 1)}
                    aria-label="Próxima partida"
                  >
                    <ChevronRight />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={current >= total - 1}
                    onClick={() => setCurrent(total - 1)}
                    aria-label="Última partida"
                  >
                    <ChevronLast />
                  </Button>
                </>
              )}
              {readOnly && (
                <Badge variant="secondary" className="ml-auto">
                  <Lock /> Zeramento
                </Badge>
              )}
            </div>
          )}

          <Tabs defaultValue="identificacao" className="px-4 pt-3">
            <TabsList>
              <TabsTrigger value="identificacao">Identificação</TabsTrigger>
            </TabsList>
            <TabsContent value="identificacao" className="grid min-w-0 gap-4 pt-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[10rem_9rem_1fr]">
                <div className="grid gap-2">
                  <Label htmlFor="date">Data</Label>
                  <Input id="date" type="date" value={draft.date} disabled={readOnly} onChange={(e) => update({ date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="history">Histórico</Label>
                  <div className="flex gap-1">
                    <Input
                      id="history"
                      inputMode="numeric"
                      value={draft.historyCode}
                      disabled={readOnly}
                      onChange={(e) => setHistoryCode(e.target.value.replace(/\D/g, ""))}
                    />
                    {!readOnly && histories.length > 0 && <HistoryPicker histories={histories} onPick={setHistoryCode} />}
                  </div>
                </div>
                <div className="col-span-2 grid gap-2 sm:col-span-1">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={draft.description}
                    disabled={readOnly}
                    onChange={(e) => update({ description: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="debit-account" className="font-semibold">
                  Conta débito
                </Label>
                <AccountPicker
                  id="debit-account"
                  accounts={accounts}
                  value={partida.debitAccountId}
                  onChange={(debitAccountId) => setPartida({ debitAccountId })}
                  allowClear={total > 1}
                  className={cn("min-w-0", readOnly && "pointer-events-none opacity-90")}
                  placeholder="Conta a débito"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="credit-account" className="font-semibold">
                  Conta crédito
                </Label>
                <AccountPicker
                  id="credit-account"
                  accounts={accounts}
                  value={partida.creditAccountId}
                  onChange={(creditAccountId) => setPartida({ creditAccountId })}
                  allowClear={total > 1}
                  className={cn("min-w-0", readOnly && "pointer-events-none opacity-90")}
                  placeholder="Conta a crédito"
                />
              </div>
              <div className="grid gap-2 sm:w-56">
                <Label htmlFor="value" className="font-semibold">
                  Valor (R$)
                </Label>
                <MoneyInput id="value" value={partida.cents} disabled={readOnly} onChange={(cents) => setPartida({ cents })} />
              </div>

              <fieldset className="grid grid-cols-3 gap-2 rounded-md border px-3 pb-2 text-xs tabular-nums sm:text-sm">
                <legend className="px-1 text-xs text-muted-foreground">Status</legend>
                <div>
                  <span className="text-muted-foreground">Débitos x Créditos: </span>
                  <span className={cn("font-semibold", diff !== 0 ? "text-destructive" : "text-primary")}>{formatMoney(Math.abs(diff))}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Débitos: </span>
                  <span className="font-semibold">{formatMoney(totalD)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Créditos: </span>
                  <span className="font-semibold">{formatMoney(totalC)}</span>
                </div>
              </fieldset>

              <AttachmentsPanel entryType="lancamento" entryId={draft.id} attachments={selected?.attachments ?? []} />
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t px-4 py-3 sm:justify-between">
            {draft.id && !readOnly ? (
              <ConfirmAction
                title="Excluir lançamento?"
                description={`Lançamento nº ${draft.number} - ${draft.description}`}
                onConfirm={async () => {
                  if (toastResult(await deleteEntry(draft.id!), "Lançamento excluído.")) close();
                }}
              >
                <Button type="button" variant="ghost" className="text-destructive">
                  <Trash2 /> Excluir
                </Button>
              </ConfirmAction>
            ) : (
              <span />
            )}
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                type="button"
                onClick={confirm}
                disabled={pending || (!readOnly && dirty && (diff !== 0 || totalD === 0))}
                title={!readOnly && dirty && diff !== 0 ? "Débitos e créditos precisam fechar" : undefined}
                className="sm:min-w-24"
              >
                OK
              </Button>
              <Button type="button" variant="outline" onClick={close} disabled={pending} className="sm:min-w-24">
                Cancelar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <CardTitle>Lançamentos do período</CardTitle>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <Button className="col-span-2 sm:order-first" onClick={openNew}>
              <FilePlus2 /> Novo lançamento
            </Button>
            <Input
              className="col-span-2 sm:w-44"
              placeholder="Filtrar descrição ou nº"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go({ de: from, ate: to, q: filter.trim(), pagina: 1 })}
            />
            <PeriodPresets
              className="col-span-2"
              value={period}
              onSelect={(p) => {
                setFrom(p.from);
                setTo(p.to);
                go({ de: p.from, ate: p.to, q: filter.trim(), pagina: 1 });
              }}
            />
            <Input type="date" className="sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
            <Input type="date" className="sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
            <Button variant="outline" className="col-span-2 sm:col-span-1" onClick={() => go({ de: from, ate: to, q: filter.trim(), pagina: 1 })}>
              <Search /> Buscar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <BulkDeleteBar
            count={bulkSelected.size}
            onConfirm={() => deleteEntries([...bulkSelected])}
            onDone={() => setBulkSelected(new Set())}
          />
          <ActiveFilters controls={controls} />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={entries.some((e) => !e.closing) && entries.filter((e) => !e.closing).every((e) => bulkSelected.has(e.id))}
                      onCheckedChange={(v) => toggleBulkAll(v === true)}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <ColumnHead controls={controls} id="number" className="w-16 text-right" />
                  <ColumnHead controls={controls} id="date" className="w-28" />
                  <ColumnHead controls={controls} id="description" />
                  <ColumnHead controls={controls} id="debit" className="hidden md:table-cell" />
                  <ColumnHead controls={controls} id="credit" className="hidden md:table-cell" />
                  <ColumnHead controls={controls} id="amount" className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum lançamento entre {formatDate(period.from)} e {formatDate(period.to)}.
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((e) => {
                  const d = e.lines.filter((l) => l.side === "D");
                  const c = e.lines.filter((l) => l.side === "C");
                  const label = (ls: Line[]) => (ls.length === 1 ? accountLabel.get(ls[0].accountId) : `Vários (${ls.length})`);
                  return (
                    <TableRow
                      key={e.id}
                      onClick={() => openEntry(e)}
                      data-state={open && e.id === selectedId ? "selected" : undefined}
                      className="cursor-pointer"
                    >
                      <TableCell onClick={(evt) => evt.stopPropagation()}>
                        {!e.closing && (
                          <Checkbox
                            checked={bulkSelected.has(e.id)}
                            onCheckedChange={(v) => toggleBulkRow(e.id, v === true)}
                            aria-label={`Selecionar lançamento ${e.number}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{e.number}</TableCell>
                      <TableCell>{formatDate(e.date)}</TableCell>
                      <TableCell className="max-w-40 truncate sm:max-w-64">
                        {e.closing && <Lock className="mr-1 inline size-3 text-muted-foreground" />}
                        {e.description}
                      </TableCell>
                      <TableCell className="hidden max-w-56 truncate text-sm md:table-cell">{label(d)}</TableCell>
                      <TableCell className="hidden max-w-56 truncate text-sm md:table-cell">{label(c)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(sum(d))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            page={paging.page}
            pageSize={paging.pageSize}
            total={paging.total}
            onPageChange={(pagina) => go({ pagina })}
            onPageSizeChange={(por) => go({ por, pagina: 1 })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
