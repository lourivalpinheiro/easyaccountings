"use client";

import { LineChart, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ActiveFilters, ColumnHead, useTableControls } from "@/components/column-head";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { TablePagination, usePagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney } from "@/lib/accounting";
import { INVESTMENT_KIND_LABELS, INVESTMENT_KINDS, type InvestmentKind } from "@/lib/investment-types";
import { todayIso } from "@/lib/period";
import type { Column } from "@/lib/table-controls";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";
import { deleteInvestments, deleteValuation, saveInvestment, saveValuation } from "./actions";

type Investment = {
  id: string;
  name: string;
  kind: InvestmentKind;
  institution: string | null;
  notes: string | null;
  active: boolean;
  invested: number;
  lastValuation: { date: string; balance: number } | null;
  balance: number;
};
type Valuation = { id: string; investmentId: string; date: string; cents: number };
type Draft = { id?: string; name: string; kind: InvestmentKind; institution: string; notes: string; active: boolean };

const COLUMNS: Column<Investment>[] = [
  { id: "name", label: "Aplicação", value: (i) => i.name },
  {
    id: "kind",
    label: "Tipo",
    type: "select",
    value: (i) => i.kind,
    options: INVESTMENT_KINDS.map((k) => ({ value: k, label: INVESTMENT_KIND_LABELS[k] })),
  },
  { id: "institution", label: "Instituição", type: "select", value: (i) => i.institution },
  { id: "invested", label: "Aportes líquidos", type: "money", value: (i) => i.invested },
  { id: "balance", label: "Saldo atual", type: "money", value: (i) => i.balance },
  {
    id: "active",
    label: "Situação",
    type: "select",
    value: (i) => (i.active ? "ativa" : "encerrada"),
    options: [
      { value: "ativa", label: "Ativa" },
      { value: "encerrada", label: "Encerrada" },
    ],
  },
];

export function InvestmentsClient({ investments, valuations }: { investments: Investment[]; valuations: Valuation[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [valuing, setValuing] = useState<Investment | null>(null);
  const [valuation, setValuation] = useState({ date: todayIso(), cents: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const table = useTableControls(investments, COLUMNS);
  const { rows, pagination } = usePagination(table.rows);
  const total = useMemo(() => investments.reduce((s, i) => s + i.balance, 0), [investments]);
  const history = valuing ? valuations.filter((v) => v.investmentId === valuing.id) : [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    startTransition(async () => {
      if (toastResult(await saveInvestment(draft), draft.id ? "Aplicação atualizada." : "Aplicação cadastrada.")) setDraft(null);
    });
  }

  function submitValuation(e: React.FormEvent) {
    e.preventDefault();
    if (!valuing) return;
    startTransition(async () => {
      toastResult(await saveValuation({ investmentId: valuing.id, ...valuation }), "Saldo informado.");
    });
  }

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="gap-1 py-4">
          <CardHeader className="flex flex-row items-center justify-between px-4">
            <CardDescription>Total aplicado</CardDescription>
            <PiggyBank className="size-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 text-2xl font-semibold tabular-nums">{formatMoney(total)}</CardContent>
        </Card>
        <Card className="gap-1 py-4">
          <CardHeader className="flex flex-row items-center justify-between px-4">
            <CardDescription>Aplicações ativas</CardDescription>
            <LineChart className="size-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 text-2xl font-semibold tabular-nums">{investments.filter((i) => i.active).length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setDraft({ name: "", kind: "cdb", institution: "", notes: "", active: true })}>
              <Plus /> Nova aplicação
            </Button>
          </div>
          <BulkDeleteBar count={selected.size} onConfirm={() => deleteInvestments([...selected])} onDone={() => setSelected(new Set())} />
          <ActiveFilters controls={table.controls} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={rows.length > 0 && rows.every((i) => selected.has(i.id))}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(rows.map((i) => i.id)) : new Set())}
                    aria-label="Selecionar todas"
                  />
                </TableHead>
                <ColumnHead controls={table.controls} id="name" />
                <ColumnHead controls={table.controls} id="kind" className="hidden md:table-cell" />
                <ColumnHead controls={table.controls} id="institution" className="hidden lg:table-cell" />
                <ColumnHead controls={table.controls} id="invested" className="hidden text-right sm:table-cell" />
                <ColumnHead controls={table.controls} id="balance" className="text-right" />
                <ColumnHead controls={table.controls} id="active" className="hidden md:table-cell" />
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {investments.length === 0 ? "Nenhuma aplicação cadastrada." : "Nenhuma aplicação encontrada."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((i) => (
                <TableRow key={i.id} className={cn(!i.active && "opacity-60")}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(i.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v === true) next.add(i.id);
                          else next.delete(i.id);
                          return next;
                        })
                      }
                      aria-label={`Selecionar ${i.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {i.name}
                    <div className="text-xs font-normal text-muted-foreground md:hidden">{INVESTMENT_KIND_LABELS[i.kind]}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{INVESTMENT_KIND_LABELS[i.kind]}</TableCell>
                  <TableCell className="hidden lg:table-cell">{i.institution ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(i.invested)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div className="font-medium">{formatMoney(i.balance)}</div>
                    {i.lastValuation && (
                      <div className="text-xs text-muted-foreground">saldo informado em {formatDate(i.lastValuation.date)}</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={i.active ? "outline" : "secondary"}>{i.active ? "Ativa" : "Encerrada"}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Atualizar saldo"
                      title="Atualizar saldo (rendimentos)"
                      onClick={() => {
                        setValuing(i);
                        setValuation({ date: todayIso(), cents: i.balance });
                      }}
                    >
                      <LineChart />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() =>
                        setDraft({
                          id: i.id,
                          name: i.name,
                          kind: i.kind,
                          institution: i.institution ?? "",
                          notes: i.notes ?? "",
                          active: i.active,
                        })
                      }
                    >
                      <Pencil />
                    </Button>
                    <ConfirmAction
                      title="Excluir aplicação?"
                      description={`${i.name}. As movimentações do fluxo de caixa são mantidas, sem o vínculo com a aplicação.`}
                      onConfirm={async () => toastResult(await deleteInvestments([i.id]), "Aplicação excluída.")}
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
      </Card>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          {draft && (
            <form onSubmit={submit} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar aplicação" : "Nova aplicação"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="inv-name">Nome</Label>
                <Input
                  id="inv-name"
                  value={draft.name}
                  maxLength={120}
                  placeholder="Ex.: Reserva de emergência - CDB liquidez diária"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="inv-kind">Tipo</Label>
                  <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as InvestmentKind })}>
                    <SelectTrigger id="inv-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {INVESTMENT_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {INVESTMENT_KIND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="inv-inst">Instituição</Label>
                  <Input
                    id="inv-inst"
                    value={draft.institution}
                    maxLength={120}
                    onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inv-notes">Observações</Label>
                <Textarea id="inv-notes" value={draft.notes} maxLength={500} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v === true })} />
                Aplicação ativa
              </label>
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

      <Dialog open={valuing !== null} onOpenChange={(o) => !o && setValuing(null)}>
        <DialogContent>
          {valuing && (
            <div className="grid gap-4">
              <DialogHeader>
                <DialogTitle>Saldo de {valuing.name}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Informe o saldo do extrato da aplicação numa data. Ele já inclui os rendimentos; aportes e resgates lançados
                depois dessa data são somados automaticamente.
              </p>
              <form onSubmit={submitValuation} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="val-date">Data</Label>
                  <Input id="val-date" type="date" value={valuation.date} onChange={(e) => setValuation({ ...valuation, date: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="val-cents">Saldo</Label>
                  <MoneyInput id="val-cents" value={valuation.cents} onChange={(cents) => setValuation({ ...valuation, cents })} />
                </div>
                <Button type="submit" disabled={pending}>
                  Salvar
                </Button>
              </form>
              {history.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Saldo informado</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{formatDate(v.date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(v.cents)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Excluir saldo"
                            onClick={() => startTransition(async () => void toastResult(await deleteValuation(v.id), "Saldo excluído."))}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
