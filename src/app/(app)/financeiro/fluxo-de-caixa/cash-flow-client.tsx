"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  BookOpen,
  CalendarX,
  CreditCard,
  FileText,
  Pencil,
  PiggyBank,
  Plus,
  Repeat,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AccountPicker, AccountQuickCreate, type PickerAccount } from "@/components/account-picker";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { ActiveFilters, ColumnHead, useUrlTableControls } from "@/components/column-head";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { PeriodPicker } from "@/components/period-presets";
import { TablePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate, formatMoney } from "@/lib/accounting";
import {
  FLOW_TYPE_LABELS,
  FLOW_TYPES,
  FREQUENCIES,
  FREQUENCY_LABELS,
  isInflow,
  MAX_OCCURRENCES,
  type FlowType,
  type Frequency,
} from "@/lib/cash-flow-types";
import { todayIso } from "@/lib/period";
import { toastResult } from "@/lib/toast-result";
import type { Filters, SortState } from "@/lib/table-controls";
import { cn } from "@/lib/utils";
import { deleteCashFlowEntries, deleteCashFlowEntry, deleteCashFlowSeriesFrom, saveCashFlowEntry } from "../actions";
import { CASH_FLOW_COLUMNS } from "./columns";

type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number; isPublic: boolean };
type LinkedJournal = { journalEntryId: string; entryNumber: number; bankAccountId: string; counterAccountId: string; historyCode: number | null };
type Entry = {
  id: string;
  date: string;
  type: FlowType;
  description: string;
  category: string | null;
  cents: number;
  frequency: Frequency;
  seriesId: string | null;
  investmentId: string | null;
  attachments: Attachment[];
  contabil: LinkedJournal | null;
};
type ContabilDraft = { bankAccountId: string | null; counterAccountId: string | null; historyCode: string };
type Draft = {
  id?: string;
  date: string;
  type: FlowType;
  description: string;
  category: string;
  cents: number;
  frequency: Frequency;
  occurrences: number;
  investmentId: string | null;
  contabilEnabled: boolean;
  contabil: ContabilDraft;
  /** Vínculo contábil que já existia ao abrir o formulário (para saber se precisa desvincular ao salvar). */
  originallyLinked: boolean;
};

const NO_INVESTMENT = "nenhuma";
const NO_HISTORY = "nenhum";
const blankContabil = (): ContabilDraft => ({ bankAccountId: null, counterAccountId: null, historyCode: "" });

const TYPE_STYLE: Record<FlowType, { icon: typeof Wallet; tone: string; on: string; button: string }> = {
  entrada: {
    icon: ArrowUpCircle,
    tone: "text-emerald-600 dark:text-emerald-400",
    on: "data-[state=on]:text-emerald-600",
    button: "bg-emerald-600 text-white hover:bg-emerald-600/90",
  },
  saida: {
    icon: ArrowDownCircle,
    tone: "text-destructive",
    on: "data-[state=on]:text-destructive",
    button: "bg-destructive text-white hover:bg-destructive/90",
  },
  economia: {
    icon: PiggyBank,
    tone: "text-sky-600 dark:text-sky-400",
    on: "data-[state=on]:text-sky-600",
    button: "bg-sky-600 text-white hover:bg-sky-600/90",
  },
  cartao_credito: {
    icon: CreditCard,
    tone: "text-violet-600 dark:text-violet-400",
    on: "data-[state=on]:text-violet-600",
    button: "bg-violet-600 text-white hover:bg-violet-600/90",
  },
};

export function CashFlowClient({
  period,
  query,
  table,
  paging,
  summary,
  categories,
  investments,
  accounts,
  histories,
  entries,
}: {
  period: { from: string; to: string };
  query: string;
  table: { sort: SortState; filters: Filters };
  paging: { page: number; pageSize: number; total: number };
  summary: { previous: number; inflow: number; outflow: number; byType: Record<FlowType, number> };
  categories: string[];
  investments: { id: string; name: string; active: boolean }[];
  accounts: PickerAccount[];
  histories: { code: number; description: string }[];
  entries: Entry[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState(query);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const attachmentsRef = useRef<((id: string) => Promise<void>) | null>(null);
  const controls = useUrlTableControls(CASH_FLOW_COLUMNS, table, {
    category: categories.map((c) => ({ value: c, label: c })),
  });
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

  const go = (changes: { pagina?: number; por?: number; de?: string; ate?: string } = {}) => {
    // Mantém ordenação e filtros de coluna já presentes na URL.
    const p = new URLSearchParams(window.location.search);
    p.set("de", changes.de ?? period.from);
    p.set("ate", changes.ate ?? period.to);
    p.set("pagina", String(changes.pagina ?? 1));
    p.set("por", String(changes.por ?? paging.pageSize));
    if (q.trim()) p.set("q", q.trim());
    else p.delete("q");
    router.push(`?${p.toString()}`);
  };

  const open = (type: FlowType) =>
    setDraft({
      date: todayIso(),
      type,
      description: "",
      category: "",
      cents: 0,
      frequency: "unica",
      occurrences: 12,
      investmentId: null,
      contabilEnabled: false,
      contabil: blankContabil(),
      originallyLinked: false,
    });

  const edit = (e: Entry) =>
    setDraft({
      ...e,
      category: e.category ?? "",
      occurrences: 1,
      contabilEnabled: Boolean(e.contabil),
      contabil: e.contabil
        ? { bankAccountId: e.contabil.bankAccountId, counterAccountId: e.contabil.counterAccountId, historyCode: e.contabil.historyCode ? String(e.contabil.historyCode) : "" }
        : blankContabil(),
      originallyLinked: Boolean(e.contabil),
    });

  const allowContabil = Boolean(draft?.id) || draft?.frequency === "unica";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const contabilPayload = !allowContabil
      ? undefined
      : draft.contabilEnabled
        ? draft.contabil.bankAccountId && draft.contabil.counterAccountId
          ? {
              bankAccountId: draft.contabil.bankAccountId,
              counterAccountId: draft.contabil.counterAccountId,
              historyCode: draft.contabil.historyCode ? Number(draft.contabil.historyCode) : null,
            }
          : undefined
        : draft.originallyLinked
          ? null
          : undefined;
    startTransition(async () => {
      const result = await saveCashFlowEntry({ ...draft, contabil: contabilPayload });
      const ok = toastResult(
        result,
        draft.id
          ? "Registro atualizado."
          : draft.frequency !== "unica"
            ? `${draft.occurrences} ocorrências registradas.`
            : "Movimentação registrada.",
      );
      if (ok && result.ok && result.data) await attachmentsRef.current?.(result.data.id);
      if (ok) setDraft(null);
    });
  }

  const cards = [
    { label: "Saldo anterior", value: summary.previous, icon: Wallet, signed: true, tone: undefined as string | undefined },
    ...FLOW_TYPES.map((t) => ({
      label: FLOW_TYPE_LABELS[t].plural,
      value: summary.byType[t],
      icon: TYPE_STYLE[t].icon,
      tone: TYPE_STYLE[t].tone,
      signed: false,
    })),
    { label: "Saldo final", value: final, icon: Wallet, signed: true, tone: undefined },
  ];

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => open("entrada")}>
          <Plus /> Nova movimentação
        </Button>
        <Button variant="outline" className="sm:ml-auto" asChild>
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
            <PeriodPicker className="col-span-2" value={period} onChange={(p) => go({ de: p.from, ate: p.to })} />
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
          <ActiveFilters controls={controls} />
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
                <ColumnHead controls={controls} id="date" className="w-24" />
                <ColumnHead controls={controls} id="description" />
                <ColumnHead controls={controls} id="type" className="hidden lg:table-cell" />
                <ColumnHead controls={controls} id="category" className="hidden md:table-cell" />
                <ColumnHead controls={controls} id="amount" className="text-right" />
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{e.description}</span>
                      {e.seriesId && (
                        <Repeat
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label={`Recorrente: ${FREQUENCY_LABELS[e.frequency]}`}
                        />
                      )}
                      {e.contabil && (
                        <BookOpen
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label={`Lançamento contábil nº ${e.contabil.entryNumber}`}
                        />
                      )}
                    </div>
                    <div className={cn("text-xs lg:hidden", TYPE_STYLE[e.type].tone)}>{FLOW_TYPE_LABELS[e.type].singular}</div>
                    {e.category && <div className="truncate text-xs text-muted-foreground md:hidden">{e.category}</div>}
                  </TableCell>
                  <TableCell className={cn("hidden lg:table-cell", TYPE_STYLE[e.type].tone)}>{FLOW_TYPE_LABELS[e.type].singular}</TableCell>
                  <TableCell className="hidden md:table-cell">{e.category ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium whitespace-nowrap tabular-nums",
                      TYPE_STYLE[e.type].tone,
                    )}
                  >
                    {isInflow(e.type) ? "+" : "-"} {formatMoney(e.cents)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => edit(e)}
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
                    {e.seriesId && (
                      <ConfirmAction
                        title="Excluir esta e as próximas?"
                        description={`Exclui "${e.description}" de ${formatDate(e.date)} e as ocorrências seguintes da recorrência (${FREQUENCY_LABELS[e.frequency].toLowerCase()}).`}
                        onConfirm={async () => toastResult(await deleteCashFlowSeriesFrom(e.id), "Recorrência excluída.")}
                      >
                        <Button variant="ghost" size="icon" aria-label="Excluir esta e as próximas">
                          <CalendarX className="text-destructive" />
                        </Button>
                      </ConfirmAction>
                    )}
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
                <DialogTitle>{draft.id ? "Editar movimentação" : "Nova movimentação"}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="financeiro">
                <TabsList>
                  <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                  <TabsTrigger value="contabilidade">Contabilidade</TabsTrigger>
                </TabsList>
                <TabsContent value="financeiro" className="grid gap-4 pt-2">
              <ToggleGroup
                type="single"
                variant="outline"
                value={draft.type}
                onValueChange={(v) => v && setDraft({ ...draft, type: v as FlowType })}
                className="grid w-full grid-cols-2"
              >
                {FLOW_TYPES.map((t) => {
                  const Icon = TYPE_STYLE[t].icon;
                  return (
                    <ToggleGroupItem key={t} value={t} className={cn("flex-1", TYPE_STYLE[t].on)}>
                      <Icon /> {FLOW_TYPE_LABELS[t].singular}
                    </ToggleGroupItem>
                  );
                })}
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
              {draft.id ? (
                draft.frequency !== "unica" && (
                  <p className="text-xs text-muted-foreground">
                    Ocorrência de uma recorrência {FREQUENCY_LABELS[draft.frequency].toLowerCase()}. A edição altera apenas
                    esta data.
                  </p>
                )
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="cf-freq">Frequência</Label>
                    <Select value={draft.frequency} onValueChange={(v) => setDraft({ ...draft, frequency: v as Frequency })}>
                      <SelectTrigger id="cf-freq" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {FREQUENCIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {FREQUENCY_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {draft.frequency !== "unica" && (
                    <div className="grid gap-2">
                      <Label htmlFor="cf-occ">Repetições</Label>
                      <Input
                        id="cf-occ"
                        type="number"
                        min={2}
                        max={MAX_OCCURRENCES}
                        value={draft.occurrences || ""}
                        onChange={(e) => setDraft({ ...draft, occurrences: Math.floor(Number(e.target.value)) || 0 })}
                        required
                      />
                    </div>
                  )}
                  {draft.frequency !== "unica" && draft.occurrences >= 2 && (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      Serão criadas {draft.occurrences} movimentações a partir de {formatDate(draft.date)}.
                    </p>
                  )}
                </div>
              )}
              {(draft.type === "economia" || draft.type === "entrada") && investments.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="cf-inv">{draft.type === "economia" ? "Aporte na aplicação (opcional)" : "Resgate da aplicação (opcional)"}</Label>
                  <Select
                    value={draft.investmentId ?? NO_INVESTMENT}
                    onValueChange={(v) => setDraft({ ...draft, investmentId: v === NO_INVESTMENT ? null : v })}
                  >
                    <SelectTrigger id="cf-inv" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value={NO_INVESTMENT}>Nenhuma</SelectItem>
                      {investments
                        .filter((i) => i.active || i.id === draft.investmentId)
                        .map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
                </TabsContent>
                <TabsContent value="contabilidade" className="grid gap-4 pt-2">
                  {!allowContabil ? (
                    <p className="text-sm text-muted-foreground">
                      Disponível apenas para lançamentos únicos. Crie a recorrência primeiro e, depois, edite a ocorrência
                      desejada para ligá-la à contabilidade.
                    </p>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={draft.contabilEnabled}
                          onCheckedChange={(v) => setDraft({ ...draft, contabilEnabled: v === true })}
                        />
                        Lançar também na contabilidade
                      </label>
                      {draft.contabilEnabled && (
                        <>
                          <div className="grid gap-2">
                            <Label>Conta de caixa/banco</Label>
                            <div className="flex gap-2">
                              <AccountPicker
                                accounts={accounts}
                                value={draft.contabil.bankAccountId}
                                onChange={(bankAccountId) => setDraft({ ...draft, contabil: { ...draft.contabil, bankAccountId } })}
                                placeholder="Selecione a conta de caixa ou banco"
                                className="flex-1"
                              />
                              <AccountQuickCreate
                                accounts={accounts}
                                onCreated={(bankAccountId) => setDraft({ ...draft, contabil: { ...draft.contabil, bankAccountId } })}
                              />
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label>Conta de contrapartida</Label>
                            <div className="flex gap-2">
                              <AccountPicker
                                accounts={accounts}
                                value={draft.contabil.counterAccountId}
                                onChange={(counterAccountId) => setDraft({ ...draft, contabil: { ...draft.contabil, counterAccountId } })}
                                placeholder="Selecione a conta de contrapartida"
                                className="flex-1"
                              />
                              <AccountQuickCreate
                                accounts={accounts}
                                onCreated={(counterAccountId) => setDraft({ ...draft, contabil: { ...draft.contabil, counterAccountId } })}
                              />
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="cf-history">Histórico (opcional)</Label>
                            <Select
                              value={draft.contabil.historyCode || NO_HISTORY}
                              onValueChange={(v) => setDraft({ ...draft, contabil: { ...draft.contabil, historyCode: v === NO_HISTORY ? "" : v } })}
                            >
                              <SelectTrigger id="cf-history" className="w-full">
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
                          {!draft.contabil.bankAccountId || !draft.contabil.counterAccountId ? (
                            <p className="text-xs text-destructive">Escolha as duas contas para lançar na contabilidade.</p>
                          ) : null}
                        </>
                      )}
                      {draft.id && entries.find((e) => e.id === draft.id)?.contabil && (
                        <p className="text-xs text-muted-foreground">
                          Lançamento contábil nº {entries.find((e) => e.id === draft.id)!.contabil!.entryNumber}.{" "}
                          <Link
                            href={`/movimento/lancamentos?de=${draft.date}&ate=${draft.date}&q=${entries.find((e) => e.id === draft.id)!.contabil!.entryNumber}&abrir=${entries.find((e) => e.id === draft.id)!.contabil!.journalEntryId}`}
                            className="text-primary underline"
                            target="_blank"
                          >
                            Abrir lançamento
                          </Link>
                        </p>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
              <AttachmentsPanel
                entryType="movimentacao"
                entryId={draft.id}
                attachments={entries.find((e) => e.id === draft.id)?.attachments ?? []}
                stagedRef={attachmentsRef}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    pending ||
                    draft.cents <= 0 ||
                    (!draft.id &&
                      draft.frequency !== "unica" &&
                      (draft.occurrences < 2 || draft.occurrences > MAX_OCCURRENCES)) ||
                    (draft.contabilEnabled && (!draft.contabil.bankAccountId || !draft.contabil.counterAccountId))
                  }
                >
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
