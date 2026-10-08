"use client";

import { ChevronDown, CopyPlus, FilePlus2, Lock, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AccountPicker, type PickerAccount } from "@/components/account-picker";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FORMULA_LABELS,
  formatDate,
  formatMoney,
  formulaOf,
  type EntryFormula,
} from "@/lib/accounting";
import { todayIso } from "@/lib/period";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";
import { deleteEntry, saveEntry } from "../actions";

type Line = { accountId: string; side: "D" | "C"; cents: number };
type Entry = {
  id: string;
  number: number;
  date: string;
  historyCode: number | null;
  description: string;
  closing: boolean;
  lines: Line[];
};
type Row = { accountId: string | null; cents: number };
type Draft = {
  id?: string;
  number?: number;
  date: string;
  historyCode: string;
  description: string;
  formula: EntryFormula;
  debits: Row[];
  credits: Row[];
};

const emptyRow = (): Row => ({ accountId: null, cents: 0 });

function blankDraft(date = todayIso()): Draft {
  return { date, historyCode: "", description: "", formula: "1x1", debits: [emptyRow()], credits: [emptyRow()] };
}

function draftFromEntry(e: Entry): Draft {
  const debits = e.lines.filter((l) => l.side === "D").map(({ accountId, cents }) => ({ accountId, cents }));
  const credits = e.lines.filter((l) => l.side === "C").map(({ accountId, cents }) => ({ accountId, cents }));
  return {
    id: e.id,
    number: e.number,
    date: e.date,
    historyCode: e.historyCode ? String(e.historyCode) : "",
    description: e.description,
    formula: formulaOf(debits.length, credits.length),
    debits,
    credits,
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

const sum = (rows: Row[]) => rows.reduce((s, r) => s + r.cents, 0);

/** Lado único das fórmulas 1xN / Nx1 acompanha automaticamente o total do outro lado. */
function balanced(d: Draft): Draft {
  if (d.formula === "1x1") return { ...d, credits: [{ ...d.credits[0], cents: d.debits[0].cents }] };
  if (d.formula === "1xN") return { ...d, debits: [{ ...d.debits[0], cents: sum(d.credits) }] };
  if (d.formula === "Nx1") return { ...d, credits: [{ ...d.credits[0], cents: sum(d.debits) }] };
  return d;
}

export function EntriesClient({
  period,
  query,
  paging,
  accounts,
  histories,
  entries,
}: {
  period: { from: string; to: string };
  query: string;
  paging: { page: number; pageSize: number; total: number };
  accounts: PickerAccount[];
  histories: { code: number; description: string }[];
  entries: Entry[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const [mode, setMode] = useState<"view" | "new" | "edit">(entries.length ? "view" : "new");
  const [draft, setDraft] = useState<Draft>(() => (entries[0] ? draftFromEntry(entries[0]) : blankDraft()));
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [filter, setFilter] = useState(query);
  const [pending, startTransition] = useTransition();

  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const editing = mode !== "view";
  const accountLabel = useMemo(() => new Map(accounts.map((a) => [a.id, `${a.classification} - ${a.name}`])), [accounts]);

  const totalD = sum(draft.debits);
  const totalC = sum(draft.credits);
  const diff = totalD - totalC;

  const update = (patch: Partial<Draft>) => setDraft((d) => balanced({ ...d, ...patch }));
  const setRow = (side: "debits" | "credits", i: number, patch: Partial<Row>) =>
    setDraft((d) => balanced({ ...d, [side]: d[side].map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const setFormula = (formula: EntryFormula) =>
    setDraft((d) => {
      const multiD = formula === "Nx1" || formula === "NxN";
      const multiC = formula === "1xN" || formula === "NxN";
      return balanced({
        ...d,
        formula,
        debits: multiD ? d.debits : [d.debits[0] ?? emptyRow()],
        credits: multiC ? d.credits : [d.credits[0] ?? emptyRow()],
      });
    });

  const select = (e: Entry) => {
    if (editing) return;
    setSelectedId(e.id);
    setDraft(draftFromEntry(e));
  };

  const cancel = () => {
    setMode(selected ? "view" : "new");
    setDraft(selected ? draftFromEntry(selected) : blankDraft());
  };

  const setHistoryCode = (code: string) => {
    const h = histories.find((x) => String(x.code) === code);
    update({ historyCode: code, ...(h ? { description: h.description } : {}) });
  };

  function save() {
    const lines = [
      ...draft.debits.map((r) => ({ accountId: r.accountId ?? "", side: "D" as const, cents: r.cents })),
      ...draft.credits.map((r) => ({ accountId: r.accountId ?? "", side: "C" as const, cents: r.cents })),
    ];
    startTransition(async () => {
      const result = await saveEntry({
        id: mode === "edit" ? draft.id : undefined,
        date: draft.date,
        historyCode: draft.historyCode ? Number(draft.historyCode) : null,
        description: draft.description,
        lines,
      });
      if (toastResult(result, mode === "edit" ? "Lançamento atualizado." : `Lançamento nº ${result.ok ? result.data?.number : ""} gravado.`) && result.ok) {
        setSelectedId(result.data!.id);
        setMode("view");
        setDraft((d) => ({ ...d, id: result.data!.id, number: result.data!.number }));
      }
    });
  }

  const visible = entries;
  const go = (changes: { pagina?: number; por?: number; de?: string; ate?: string; q?: string }) => {
    const p = new URLSearchParams({
      de: changes.de ?? period.from,
      ate: changes.ate ?? period.to,
      pagina: String(changes.pagina ?? paging.page),
      por: String(changes.por ?? paging.pageSize),
    });
    const q = changes.q ?? query;
    if (q) p.set("q", q);
    router.push(`?${p.toString()}`);
  };

  const multiDebit = draft.formula === "Nx1" || draft.formula === "NxN";
  const multiCredit = draft.formula === "1xN" || draft.formula === "NxN";

  const sidePanel = (side: "debits" | "credits") => {
    const isDebit = side === "debits";
    const multi = isDebit ? multiDebit : multiCredit;
    const auto = !multi && draft.formula !== "NxN" && (isDebit ? multiCredit : multiDebit || draft.formula === "1x1");
    return (
      <div className="grid content-start gap-2">
        <Label>{isDebit ? "Débito" : "Crédito"}</Label>
        {draft[side].map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9rem_auto]">
            <AccountPicker
              accounts={accounts}
              value={row.accountId}
              onChange={(accountId) => setRow(side, i, { accountId })}
              className={cn("col-span-2 sm:col-span-1", !editing && "pointer-events-none opacity-90")}
              placeholder={isDebit ? "Conta a débito" : "Conta a crédito"}
            />
            <MoneyInput
              value={row.cents}
              disabled={!editing || auto}
              onChange={(cents) => setRow(side, i, { cents })}
              aria-label={`Valor ${isDebit ? "débito" : "crédito"}`}
              title={auto ? "Calculado automaticamente" : undefined}
            />
            {multi && editing ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover linha"
                disabled={draft[side].length === 1}
                onClick={() => update({ [side]: draft[side].filter((_, j) => j !== i) } as Partial<Draft>)}
              >
                <X />
              </Button>
            ) : (
              <span className="w-9" />
            )}
          </div>
        ))}
        {multi && editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => update({ [side]: [...draft[side], emptyRow()] } as Partial<Draft>)}
          >
            <Plus /> Adicionar {isDebit ? "débito" : "crédito"}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            {mode === "new" ? "Novo lançamento" : `Lançamento nº ${draft.number ?? ""}`}
            {selected?.closing && mode === "view" && (
              <Badge variant="secondary">
                <Lock /> Zeramento
              </Badge>
            )}
            {mode === "edit" && <Badge variant="outline">Editando</Badge>}
          </CardTitle>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {editing ? (
              <>
                <Button variant="outline" onClick={cancel} disabled={pending}>
                  <X /> Cancelar
                </Button>
                <Button onClick={save} disabled={pending || diff !== 0 || totalD === 0}>
                  <Save /> Gravar
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => {
                    setMode("new");
                    setDraft(blankDraft(selected?.date));
                  }}
                >
                  <FilePlus2 /> Novo
                </Button>
                <Button
                  variant="outline"
                  disabled={!selected}
                  onClick={() => {
                    if (!selected) return;
                    const copy = draftFromEntry(selected);
                    setMode("new");
                    setDraft({ ...copy, id: undefined, number: undefined });
                  }}
                >
                  <CopyPlus /> Novo a partir deste
                </Button>
                <Button variant="outline" disabled={!selected || selected.closing} onClick={() => setMode("edit")}>
                  <Pencil /> Editar
                </Button>
                <ConfirmAction
                  title="Excluir lançamento?"
                  description={selected ? `Lançamento nº ${selected.number} - ${selected.description}` : ""}
                  onConfirm={async () => {
                    if (!selected) return;
                    if (toastResult(await deleteEntry(selected.id), "Lançamento excluído.")) {
                      const next = entries.find((e) => e.id !== selected.id);
                      setSelectedId(next?.id ?? null);
                      setDraft(next ? draftFromEntry(next) : blankDraft());
                      setMode(next ? "view" : "new");
                    }
                  }}
                >
                  <Button variant="outline" disabled={!selected || selected.closing}>
                    <Trash2 className="text-destructive" /> Excluir
                  </Button>
                </ConfirmAction>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-[10rem_8rem_1fr_16rem]">
            <div className="grid gap-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={draft.date} disabled={!editing} onChange={(e) => update({ date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="history">Cód. histórico</Label>
              <div className="flex gap-1">
                <Input
                  id="history"
                  inputMode="numeric"
                  value={draft.historyCode}
                  disabled={!editing}
                  onChange={(e) => setHistoryCode(e.target.value.replace(/\D/g, ""))}
                />
                {editing && histories.length > 0 && (
                  <HistoryPicker histories={histories} onPick={setHistoryCode} />
                )}
              </div>
            </div>
            <div className="col-span-2 grid gap-2 lg:col-span-1">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={draft.description}
                disabled={!editing}
                onChange={(e) => update({ description: e.target.value })}
              />
            </div>
            <div className="col-span-2 grid gap-2 lg:col-span-1">
              <Label>Fórmula</Label>
              <Select value={draft.formula} onValueChange={(v) => setFormula(v as EntryFormula)} disabled={!editing}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FORMULA_LABELS) as EntryFormula[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FORMULA_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {sidePanel("debits")}
            {sidePanel("credits")}
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-xs tabular-nums sm:gap-3 sm:text-sm">
            <div>
              <div className="text-muted-foreground">Total de débitos</div>
              <div className="text-sm font-semibold sm:text-lg">{formatMoney(totalD)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total de créditos</div>
              <div className="text-sm font-semibold sm:text-lg">{formatMoney(totalC)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Diferença</div>
              <div className={cn("text-sm font-semibold sm:text-lg", diff !== 0 ? "text-destructive" : "text-primary")}>
                {formatMoney(Math.abs(diff))}
                {diff !== 0 && <span className="ml-1 hidden text-xs sm:inline">({diff > 0 ? "débito maior" : "crédito maior"})</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <CardTitle>Lançamentos do período</CardTitle>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <Input
              className="col-span-2 sm:w-44"
              placeholder="Filtrar descrição ou nº"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go({ de: from, ate: to, q: filter.trim(), pagina: 1 })}
            />
            <Input type="date" className="sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
            <Input type="date" className="sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
            <Button variant="outline" className="col-span-2 sm:col-span-1" onClick={() => go({ de: from, ate: to, q: filter.trim(), pagina: 1 })}>
              <Search /> Buscar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-right">Nº</TableHead>
                  <TableHead className="w-28">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden md:table-cell">Débito</TableHead>
                  <TableHead className="hidden md:table-cell">Crédito</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum lançamento entre {formatDate(period.from)} e {formatDate(period.to)}.
                    </TableCell>
                  </TableRow>
                )}
                {visible.map((e) => {
                  const d = e.lines.filter((l) => l.side === "D");
                  const c = e.lines.filter((l) => l.side === "C");
                  const label = (ls: Line[]) => (ls.length === 1 ? accountLabel.get(ls[0].accountId) : `Vários (${ls.length})`);
                  return (
                    <TableRow
                      key={e.id}
                      onClick={() => select(e)}
                      data-state={e.id === selectedId ? "selected" : undefined}
                      className={cn("cursor-pointer", editing && "cursor-not-allowed opacity-60")}
                    >
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
