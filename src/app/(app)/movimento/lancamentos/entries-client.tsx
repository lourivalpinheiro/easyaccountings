"use client";

import { CopyPlus, FilePlus2, Lock, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AccountPicker, type PickerAccount } from "@/components/account-picker";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  accounts,
  histories,
  entries,
}: {
  period: { from: string; to: string };
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
  const [filter, setFilter] = useState("");
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

  const visible = filter.trim()
    ? entries.filter(
        (e) =>
          e.description.toLowerCase().includes(filter.toLowerCase()) || String(e.number) === filter.trim(),
      )
    : entries;

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
          <div key={i} className="grid grid-cols-[1fr_9rem_auto] gap-2">
            <AccountPicker
              accounts={accounts}
              value={row.accountId}
              onChange={(accountId) => setRow(side, i, { accountId })}
              className={cn(!editing && "pointer-events-none opacity-90")}
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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {mode === "new" ? "Novo lançamento" : `Lançamento nº ${draft.number ?? ""}`}
            {selected?.closing && mode === "view" && (
              <Badge variant="secondary">
                <Lock /> Zeramento
              </Badge>
            )}
            {mode === "edit" && <Badge variant="outline">Editando</Badge>}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
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
          <div className="grid gap-3 md:grid-cols-[10rem_8rem_1fr_16rem]">
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
                  <Select value="" onValueChange={setHistoryCode}>
                    <SelectTrigger className="w-9 px-2" aria-label="Escolher histórico" />
                    <SelectContent>
                      {histories.map((h) => (
                        <SelectItem key={h.code} value={String(h.code)}>
                          {h.code} - {h.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={draft.description}
                disabled={!editing}
                onChange={(e) => update({ description: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
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

          <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-3 text-sm tabular-nums">
            <div>
              <div className="text-muted-foreground">Total de débitos</div>
              <div className="text-lg font-semibold">{formatMoney(totalD)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total de créditos</div>
              <div className="text-lg font-semibold">{formatMoney(totalC)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Diferença</div>
              <div className={cn("text-lg font-semibold", diff !== 0 ? "text-destructive" : "text-primary")}>
                {formatMoney(Math.abs(diff))}
                {diff !== 0 && <span className="ml-1 text-xs">({diff > 0 ? "débito maior" : "crédito maior"})</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
          <CardTitle>Lançamentos do período</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <Input className="w-44" placeholder="Filtrar descrição ou nº" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="De" />
            <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Até" />
            <Button variant="outline" onClick={() => router.push(`?de=${from}&ate=${to}`)}>
              <Search /> Buscar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[28rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-right">Nº</TableHead>
                  <TableHead className="w-28">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Débito</TableHead>
                  <TableHead>Crédito</TableHead>
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
                      <TableCell className="max-w-64 truncate">
                        {e.closing && <Lock className="mr-1 inline size-3 text-muted-foreground" />}
                        {e.description}
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-sm">{label(d)}</TableCell>
                      <TableCell className="max-w-56 truncate text-sm">{label(c)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(sum(d))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
