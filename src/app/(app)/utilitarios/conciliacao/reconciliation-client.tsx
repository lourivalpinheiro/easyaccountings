"use client";

import { Bot, Check, Trash2, Undo2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { AccountPicker, AccountQuickCreate, type PickerAccount } from "@/components/account-picker";
import { ConfirmAction } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatDateTimeBrasilia, formatMoney } from "@/lib/accounting";
import {
  deleteBankTransactions,
  deleteKnot,
  deleteStatement,
  importStatement,
  reconcileTransaction,
  undoReconciliation,
} from "@/lib/reconciliation-actions";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";
import { ActiveFilters, ColumnHead, useTableControls } from "@/components/column-head";
import type { Column } from "@/lib/table-controls";

type Transaction = {
  id: string;
  date: string;
  amountCents: number;
  description: string;
  journalEntryId: string | null;
  cashFlowEntryId: string | null;
  matchedByKnot: boolean;
  bankAccountId: string;
};
type Statement = { id: string; fileName: string; createdAt: string; bankAccountName: string; bankAccountClassification: string };
type Knot = {
  id: string;
  pattern: string;
  module: "contabil" | "financeiro" | "ambos";
  historyCode: number | null;
  cashCategory: string | null;
  counterAccountId: string | null;
  counterAccountName: string | null;
  counterAccountClassification: string | null;
};

const MODULE_LABELS: Record<Knot["module"], string> = { contabil: "Contábil", financeiro: "Financeiro", ambos: "Ambos" };

const STATEMENT_COLUMNS: Column<Statement>[] = [
  { id: "fileName", label: "Arquivo", value: (s) => s.fileName },
  { id: "bankAccount", label: "Conta bancária", value: (s) => `${s.bankAccountClassification} - ${s.bankAccountName}` },
  { id: "createdAt", label: "Importado em", type: "date", value: (s) => s.createdAt },
];

const DONE_OPTIONS = [
  { value: "feito", label: "Feito" },
  { value: "pendente", label: "Pendente" },
];

const PENDING_COLUMNS: Column<Transaction>[] = [
  { id: "date", label: "Data", type: "date", value: (t) => t.date },
  { id: "description", label: "Descrição", value: (t) => t.description },
  { id: "amount", label: "Valor", type: "money", value: (t) => t.amountCents },
  {
    id: "contabil",
    label: "Contábil",
    type: "select",
    value: (t) => (t.journalEntryId ? "feito" : "pendente"),
    options: DONE_OPTIONS,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    type: "select",
    value: (t) => (t.cashFlowEntryId ? "feito" : "pendente"),
    options: DONE_OPTIONS,
  },
];

const RECONCILED_COLUMNS: Column<Transaction>[] = [
  { id: "date", label: "Data", type: "date", value: (t) => t.date },
  { id: "description", label: "Descrição", value: (t) => t.description },
  { id: "amount", label: "Valor", type: "money", value: (t) => t.amountCents },
  {
    id: "how",
    label: "Conciliado em",
    type: "select",
    value: (t) => [t.journalEntryId && "Contábil", t.cashFlowEntryId && "Financeiro"].filter(Boolean).join(" + "),
  },
];

const KNOT_COLUMNS: Column<Knot>[] = [
  { id: "pattern", label: "Padrão (descrição)", value: (k) => k.pattern },
  {
    id: "module",
    label: "Módulo",
    type: "select",
    value: (k) => k.module,
    options: Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label })),
  },
  {
    id: "account",
    label: "Contábil",
    value: (k) => (k.counterAccountId ? `${k.counterAccountClassification} - ${k.counterAccountName}` : null),
  },
  { id: "category", label: "Financeiro", value: (k) => k.cashCategory },
];

export function ReconciliationClient({
  accounts,
  statements,
  pending,
  reconciled,
  knots,
  histories,
}: {
  accounts: PickerAccount[];
  statements: Statement[];
  pending: Transaction[];
  reconciled: Transaction[];
  knots: Knot[];
  histories: { code: number; description: string }[];
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ tx: Transaction; mode: "contabil" | "financeiro" } | null>(null);
  const [counterAccountId, setCounterAccountId] = useState<string | null>(null);
  const [historyCode, setHistoryCode] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, startImport] = useTransition();
  const [pendingReconcile, startReconcile] = useTransition();
  const statementTable = useTableControls(statements, STATEMENT_COLUMNS);
  const pendingTable = useTableControls(pending, PENDING_COLUMNS);
  const reconciledTable = useTableControls(reconciled, RECONCILED_COLUMNS);
  const knotTable = useTableControls(knots, KNOT_COLUMNS);

  function openReconcile(tx: Transaction, mode: "contabil" | "financeiro") {
    setDraft({ tx, mode });
    setCounterAccountId(null);
    setHistoryCode("");
    setCategory("");
  }

  function submitImport() {
    const file = fileInput.current?.files?.[0];
    if (!bankAccountId || !file) {
      toastResult({ ok: false, error: "Escolha a conta bancária e o arquivo." });
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    startImport(async () => {
      const result = await importStatement(bankAccountId, fd);
      if (toastResult(result)) {
        const data = result.ok ? (result.data as { imported: number; skipped: number }) : null;
        if (data) toastResult({ ok: true }, `${data.imported} transação(ões) importada(s)${data.skipped ? `, ${data.skipped} já existiam` : ""}.`);
        setImportOpen(false);
        if (fileInput.current) fileInput.current.value = "";
      }
    });
  }

  function submitReconcile() {
    if (!draft) return;
    startReconcile(async () => {
      const ok = toastResult(
        await reconcileTransaction(draft.tx.id, {
          contabil: draft.mode === "contabil" && counterAccountId ? { counterAccountId, historyCode: historyCode ? Number(historyCode) : null } : undefined,
          financeiro: draft.mode === "financeiro" ? { category: category.trim() || null } : undefined,
        }),
        "Conciliado.",
      );
      if (ok) setDraft(null);
    });
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Extratos importados</CardTitle>
            <CardDescription>{statements.length === 0 ? "Nenhum extrato importado ainda." : `${statements.length} extrato(s).`}</CardDescription>
          </div>
          <Button onClick={() => setImportOpen(true)}>
            <Upload /> Importar OFX
          </Button>
        </CardHeader>
        {statements.length > 0 && (
          <CardContent>
            <ActiveFilters controls={statementTable.controls} />
            <Table>
              <TableHeader>
                <TableRow>
                  <ColumnHead controls={statementTable.controls} id="fileName" />
                  <ColumnHead controls={statementTable.controls} id="bankAccount" />
                  <ColumnHead controls={statementTable.controls} id="createdAt" className="text-right" />
                  <TableHead className="w-16 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementTable.rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.fileName}</TableCell>
                    <TableCell>
                      {s.bankAccountClassification} - {s.bankAccountName}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDateTimeBrasilia(s.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <ConfirmAction
                        title="Excluir extrato importado?"
                        description={`Remove "${s.fileName}" e todas as transações dele. Lançamentos contábeis e financeiros criados a partir dessas transações também serão excluídos.`}
                        onConfirm={async () => toastResult(await deleteStatement(s.id), "Extrato excluído.")}
                      >
                        <Button variant="ghost" size="icon" aria-label="Excluir extrato">
                          <Trash2 className="text-destructive" />
                        </Button>
                      </ConfirmAction>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="conciliados">Conciliados ({reconciled.length})</TabsTrigger>
          <TabsTrigger value="knots">Knots ({knots.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <Card>
            <CardContent className="grid gap-3 pt-4">
              {selected.size > 0 && (
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <span>{selected.size} selecionado(s)</span>
                  <ConfirmAction
                    title={`Excluir ${selected.size} transação(ões) do extrato?`}
                    description="Só remove a transação importada (não afeta lançamentos); transações já conciliadas não são afetadas."
                    onConfirm={async () => {
                      if (toastResult(await deleteBankTransactions([...selected]), "Excluídas.")) setSelected(new Set());
                    }}
                  >
                    <Button variant="destructive" size="sm">
                      <Trash2 /> Excluir selecionadas
                    </Button>
                  </ConfirmAction>
                </div>
              )}
              <ActiveFilters controls={pendingTable.controls} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={pendingTable.rows.length > 0 && pendingTable.rows.every((t) => selected.has(t.id))}
                        onCheckedChange={(v) => setSelected(v === true ? new Set(pendingTable.rows.map((t) => t.id)) : new Set())}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <ColumnHead controls={pendingTable.controls} id="date" className="w-28" />
                    <ColumnHead controls={pendingTable.controls} id="description" />
                    <ColumnHead controls={pendingTable.controls} id="amount" className="text-right" />
                    <ColumnHead controls={pendingTable.controls} id="contabil" className="w-28 text-center" />
                    <ColumnHead controls={pendingTable.controls} id="financeiro" className="w-28 text-center" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTable.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma transação pendente.
                      </TableCell>
                    </TableRow>
                  )}
                  {pendingTable.rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Checkbox checked={selected.has(t.id)} onCheckedChange={(v) => toggleRow(t.id, v === true)} aria-label={`Selecionar ${t.description}`} />
                      </TableCell>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell className="max-w-64 truncate">{t.description}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", t.amountCents < 0 && "text-destructive")}>
                        {t.amountCents < 0 ? "-" : "+"} {formatMoney(Math.abs(t.amountCents))}
                      </TableCell>
                      <TableCell className="text-center">
                        {t.journalEntryId ? (
                          <Badge variant="secondary">
                            <Check /> Feito
                          </Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => openReconcile(t, "contabil")}>
                            Conciliar
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {t.cashFlowEntryId ? (
                          <Badge variant="secondary">
                            <Check /> Feito
                          </Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => openReconcile(t, "financeiro")}>
                            Conciliar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conciliados">
          <Card>
            <CardContent className="pt-4">
              <ActiveFilters controls={reconciledTable.controls} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <ColumnHead controls={reconciledTable.controls} id="date" className="w-28" />
                    <ColumnHead controls={reconciledTable.controls} id="description" />
                    <ColumnHead controls={reconciledTable.controls} id="amount" className="text-right" />
                    <ColumnHead controls={reconciledTable.controls} id="how" />
                    <TableHead className="w-28 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciledTable.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhuma transação conciliada ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {reconciledTable.rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell className="max-w-64 truncate">{t.description}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", t.amountCents < 0 && "text-destructive")}>
                        {t.amountCents < 0 ? "-" : "+"} {formatMoney(Math.abs(t.amountCents))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[t.journalEntryId && "Contábil", t.cashFlowEntryId && "Financeiro"].filter(Boolean).join(" + ")}
                        {t.matchedByKnot && (
                          <Badge variant="secondary" className="ml-2">
                            <Bot /> Knot
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <ConfirmAction
                          title="Desfazer conciliação?"
                          description="Remove o(s) lançamento(s) criados a partir dessa transação do extrato."
                          onConfirm={async () => toastResult(await undoReconciliation(t.id), "Conciliação desfeita.")}
                        >
                          <Button variant="ghost" size="icon" aria-label="Desfazer">
                            <Undo2 />
                          </Button>
                        </ConfirmAction>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knots">
          <Card>
            <CardHeader>
              <CardTitle>Knots</CardTitle>
              <CardDescription>
                Regras aprendidas: quando um lançamento futuro do extrato tiver a mesma descrição, a conciliação é aplicada automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActiveFilters controls={knotTable.controls} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <ColumnHead controls={knotTable.controls} id="pattern" />
                    <ColumnHead controls={knotTable.controls} id="module" />
                    <ColumnHead controls={knotTable.controls} id="account" />
                    <ColumnHead controls={knotTable.controls} id="category" />
                    <TableHead className="w-16 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {knotTable.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum Knot ainda. Concilie uma transação manualmente para criar o primeiro.
                      </TableCell>
                    </TableRow>
                  )}
                  {knotTable.rows.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="max-w-56 truncate font-medium">{k.pattern}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{MODULE_LABELS[k.module]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {k.counterAccountId ? `${k.counterAccountClassification} - ${k.counterAccountName}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{k.cashCategory ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <ConfirmAction
                          title="Excluir Knot?"
                          description={k.pattern}
                          onConfirm={async () => toastResult(await deleteKnot(k.id), "Knot excluído.")}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar extrato OFX</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Conta bancária (plano de contas)</Label>
              <AccountPicker accounts={accounts} value={bankAccountId} onChange={setBankAccountId} placeholder="Selecione a conta analítica do banco" />
            </div>
            <div className="grid gap-2">
              <Label>Arquivo .ofx</Label>
              <Input ref={fileInput} type="file" accept=".ofx,.qfx" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pendingImport} onClick={submitImport}>
              {pendingImport ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle>Conciliar no {draft.mode === "contabil" ? "contábil" : "financeiro"}</DialogTitle>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between">
                  <span>{formatDate(draft.tx.date)}</span>
                  <span className={cn("font-medium tabular-nums", draft.tx.amountCents < 0 && "text-destructive")}>
                    {draft.tx.amountCents < 0 ? "-" : "+"} {formatMoney(Math.abs(draft.tx.amountCents))}
                  </span>
                </div>
                <div className="text-muted-foreground">{draft.tx.description}</div>
              </div>

              {draft.mode === "contabil" ? (
                <div className="grid gap-2">
                  <Label>Conta de contrapartida</Label>
                  <div className="flex gap-2">
                    <AccountPicker accounts={accounts.filter((a) => a.id !== draft.tx.bankAccountId)} value={counterAccountId} onChange={setCounterAccountId} className="flex-1" />
                    <AccountQuickCreate accounts={accounts} onCreated={setCounterAccountId} />
                  </div>
                  <Label>Cód. histórico (opcional)</Label>
                  <Input
                    inputMode="numeric"
                    value={historyCode}
                    onChange={(e) => setHistoryCode(e.target.value.replace(/\D/g, ""))}
                    placeholder={histories.length > 0 ? `Ex.: ${histories[0].code}` : undefined}
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Categoria (opcional)</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: Vendas, Fornecedores" />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={pendingReconcile || (draft.mode === "contabil" && !counterAccountId)} onClick={submitReconcile}>
                  {pendingReconcile ? "Conciliando..." : "Conciliar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
