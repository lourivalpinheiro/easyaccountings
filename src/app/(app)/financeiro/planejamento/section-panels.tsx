"use client";

import { Download, Pencil, Plus, Save, Trash2, Wand2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { ConfirmAction } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { InteractiveChart } from "@/components/interactive-chart";
import { usePlan } from "@/components/plan/plan-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney } from "@/lib/accounting";
import { FLOW_TYPE_LABELS, FLOW_TYPES, type FlowType } from "@/lib/cash-flow-types";
import { budgetRows, chartData, DEFAULT_CHART, goalStatus, MONTH_SHORT, PRIORITY_LABELS } from "@/lib/plan/calc";
import type { Goal, Scenario } from "@/lib/plan/types";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";
import { deleteGoal, deleteScenario, fetchBcbRates, saveGoal, savePlanBudget, saveScenario, updatePlanMeta } from "./actions";
import type { WorkspacePlan } from "./plan-workspace";

// ---------- Diagnóstico ----------

export function DiagnosisPanel({ plan }: { plan: WorkspacePlan }) {
  const [from, setFrom] = useState(plan.diagnosisFrom);
  const [to, setTo] = useState(plan.diagnosisTo);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          toastResult(await updatePlanMeta(plan.id, { title: plan.title, diagnosisFrom: from, diagnosisTo: to }), "Período do diagnóstico atualizado.");
        });
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="diag-from" className="text-xs">
          De
        </Label>
        <Input id="diag-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" required />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="diag-to" className="text-xs">
          Até
        </Label>
        <Input id="diag-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" required />
      </div>
      <Button type="submit" variant="outline" disabled={pending || (from === plan.diagnosisFrom && to === plan.diagnosisTo)}>
        Aplicar período
      </Button>
      <p className="basis-full text-xs text-muted-foreground">
        Os indicadores, gráficos e categorias do diagnóstico usam as movimentações do fluxo de caixa nesse período.
      </p>
    </form>
  );
}

// ---------- Metas ----------

type GoalDraft = Omit<Goal, "id"> & { id?: string };
const NO_INVESTMENT = "nenhuma";

export function GoalsPanel({ plan, investments }: { plan: WorkspacePlan; investments: { id: string; name: string; active: boolean }[] }) {
  const { dataset } = usePlan();
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [pending, startTransition] = useTransition();

  const blank = (): GoalDraft => ({
    name: "",
    targetCents: 0,
    initialCents: 0,
    deadline: `${plan.year}-12-31`,
    priority: 2,
    annualReturn: 10,
    investmentId: null,
    notes: null,
  });

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meta</TableHead>
              <TableHead className="hidden sm:table-cell">Prazo</TableHead>
              <TableHead className="text-right">Objetivo</TableHead>
              <TableHead className="hidden text-right md:table-cell">Atual</TableHead>
              <TableHead className="text-right">Guardar/mês</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.goals.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma meta. Ex.: reserva de emergência de 6 meses de despesas, troca de equipamento, quitar dívidas.
                </TableCell>
              </TableRow>
            )}
            {plan.goals.map((g) => {
              const s = goalStatus(g, dataset);
              return (
                <TableRow key={g.id}>
                  <TableCell>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">Prioridade {PRIORITY_LABELS[g.priority]?.toLowerCase()}</div>
                  </TableCell>
                  <TableCell className={cn("hidden sm:table-cell", s.late && "text-destructive")}>{formatDate(g.deadline)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(g.targetCents)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {formatMoney(s.current)}
                    <div className="h-1.5 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round(s.progress * 100)}%` }} />
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", s.done && "text-emerald-600 dark:text-emerald-400")}>
                    {s.done ? "Atingida" : formatMoney(s.monthly)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" aria-label="Editar meta" onClick={() => setDraft({ ...g })}>
                      <Pencil />
                    </Button>
                    <ConfirmAction
                      title="Excluir meta?"
                      description={g.name}
                      onConfirm={async () => toastResult(await deleteGoal(plan.id, g.id), "Meta excluída.")}
                    >
                      <Button variant="ghost" size="icon" aria-label="Excluir meta">
                        <Trash2 className="text-destructive" />
                      </Button>
                    </ConfirmAction>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={() => setDraft(blank())}>
          <Plus /> Nova meta
        </Button>
      </div>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          {draft && (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  if (toastResult(await saveGoal(plan.id, draft), draft.id ? "Meta atualizada." : "Meta criada.")) setDraft(null);
                });
              }}
            >
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar meta" : "Nova meta"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="goal-name">Meta</Label>
                <Input id="goal-name" value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="goal-target">Valor objetivo</Label>
                  <MoneyInput id="goal-target" value={draft.targetCents} onChange={(targetCents) => setDraft({ ...draft, targetCents })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="goal-deadline">Prazo</Label>
                  <Input id="goal-deadline" type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Prioridade</Label>
                  <Select value={String(draft.priority)} onValueChange={(v) => setDraft({ ...draft, priority: Number(v) })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {[1, 2, 3].map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          {PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="goal-return">Rendimento esperado (% a.a.)</Label>
                  <Input
                    id="goal-return"
                    inputMode="decimal"
                    defaultValue={String(draft.annualReturn).replace(".", ",")}
                    onChange={(e) => setDraft({ ...draft, annualReturn: Number(e.target.value.replace(",", ".")) || 0 })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Valor acumulado vem de</Label>
                <Select
                  value={draft.investmentId ?? NO_INVESTMENT}
                  onValueChange={(v) => setDraft({ ...draft, investmentId: v === NO_INVESTMENT ? null : v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value={NO_INVESTMENT}>Valor informado manualmente</SelectItem>
                    {investments
                      .filter((i) => i.active || i.id === draft.investmentId)
                      .map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          Saldo da aplicação: {i.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {!draft.investmentId && (
                <div className="grid gap-2">
                  <Label htmlFor="goal-initial">Valor já acumulado</Label>
                  <MoneyInput id="goal-initial" value={draft.initialCents} onChange={(initialCents) => setDraft({ ...draft, initialCents })} />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="goal-notes">Observações</Label>
                <Textarea id="goal-notes" value={draft.notes ?? ""} maxLength={500} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending || draft.targetCents <= 0}>
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

// ---------- Orçamento ----------

type BudgetLine = { key: string; type: FlowType; category: string; months: number[] };
let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

export function BudgetPanel({ plan }: { plan: WorkspacePlan }) {
  const { dataset } = usePlan();
  const initial = useMemo(
    () => budgetRows(plan.budget).map((r) => ({ key: newKey(), type: r.type, category: r.category, months: [...r.months] })),
    [plan.budget],
  );
  const [lines, setLines] = useState<BudgetLine[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = (fn: (l: BudgetLine[]) => BudgetLine[]) => {
    setLines(fn);
    setDirty(true);
  };
  const setCell = (key: string, month: number, cents: number) =>
    update((ls) => ls.map((l) => (l.key === key ? { ...l, months: l.months.map((v, i) => (i === month ? cents : v)) } : l)));
  const fillRow = (key: string) => update((ls) => ls.map((l) => (l.key === key ? { ...l, months: l.months.map(() => l.months[0]) } : l)));

  /** Cria (ou completa) as linhas com a média mensal de cada categoria no diagnóstico. */
  const fromDiagnosis = () =>
    update((ls) => {
      const months = Math.max(1, dataset.diagnosis.monthsCount);
      const next = ls.map((l) => ({ ...l }));
      for (const c of dataset.diagnosis.categories) {
        const avg = Math.round(c.cents / months);
        if (avg <= 0) continue;
        const existing = next.find((l) => l.type === c.type && l.category.toLowerCase() === c.category.toLowerCase());
        if (existing) {
          if (existing.months.every((v) => v === 0)) existing.months = Array(12).fill(avg);
        } else {
          next.push({ key: newKey(), type: c.type, category: c.category, months: Array(12).fill(avg) });
        }
      }
      return next.sort((a, b) => FLOW_TYPES.indexOf(a.type) - FLOW_TYPES.indexOf(b.type) || a.category.localeCompare(b.category, "pt-BR"));
    });

  const totals = FLOW_TYPES.map((t) => ({
    t,
    total: lines.filter((l) => l.type === t).reduce((s, l) => s + l.months.reduce((a, b) => a + b, 0), 0),
  }));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => update((ls) => [...ls, { key: newKey(), type: "saida", category: "", months: Array(12).fill(0) }])}>
          <Plus /> Linha
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={fromDiagnosis} title="Usa a média mensal de cada categoria no período do diagnóstico">
          <Wand2 /> Preencher com médias do diagnóstico
        </Button>
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          disabled={pending || !dirty}
          onClick={() => {
            if (lines.some((l) => !l.category.trim() && l.months.some((v) => v > 0))) {
              toastResult({ ok: false, error: "Informe a categoria de todas as linhas com valores." });
              return;
            }
            startTransition(async () => {
              const items = lines.flatMap((l) => l.months.map((cents, i) => ({ type: l.type, category: l.category.trim(), month: i + 1, cents })));
              if (toastResult(await savePlanBudget(plan.id, items.filter((i) => i.category && i.cents > 0)), "Orçamento salvo.")) setDirty(false);
            });
          }}
        >
          <Save /> Salvar orçamento
        </Button>
      </div>
      <datalist id="budget-categories">
        {dataset.categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-[1] min-w-56 bg-muted p-1.5 text-left font-medium">Tipo / categoria</th>
              {MONTH_SHORT.map((m) => (
                <th key={m} className="min-w-24 p-1.5 text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="min-w-28 p-1.5 text-right font-medium">Total</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={15} className="p-4 text-center text-muted-foreground">
                  Nenhuma linha. Adicione categorias ou preencha com as médias do diagnóstico.
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.key} className="border-b last:border-0">
                <td className="sticky left-0 z-[1] bg-card p-1">
                  <div className="flex gap-1">
                    <Select value={l.type} onValueChange={(v) => update((ls) => ls.map((x) => (x.key === l.key ? { ...x, type: v as FlowType } : x)))}>
                      <SelectTrigger size="sm" className="w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FLOW_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {FLOW_TYPE_LABELS[t].singular}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      list="budget-categories"
                      value={l.category}
                      maxLength={80}
                      placeholder="Categoria"
                      className="h-8 min-w-28 text-xs"
                      onChange={(e) => update((ls) => ls.map((x) => (x.key === l.key ? { ...x, category: e.target.value } : x)))}
                    />
                  </div>
                </td>
                {l.months.map((v, i) => (
                  <td key={i} className="p-1">
                    <MoneyInput value={v} onChange={(cents) => setCell(l.key, i, cents)} className="h-8 text-xs" aria-label={`${l.category} em ${MONTH_SHORT[i]}`} />
                  </td>
                ))}
                <td className="p-1.5 text-right font-medium tabular-nums">{formatMoney(l.months.reduce((a, b) => a + b, 0))}</td>
                <td className="p-1 whitespace-nowrap">
                  <Button type="button" variant="ghost" size="icon" className="size-7" title="Repetir o valor de janeiro em todos os meses" onClick={() => fillRow(l.key)}>
                    <Download className="-rotate-90" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Remover linha" onClick={() => update((ls) => ls.filter((x) => x.key !== l.key))}>
                    <X />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {totals.map(({ t, total }) => (
          <span key={t}>
            <span className="text-muted-foreground">{FLOW_TYPE_LABELS[t].plural} no ano: </span>
            <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
          </span>
        ))}
        {dirty && <span className="text-amber-600 dark:text-amber-400">Alterações não salvas</span>}
      </div>
    </div>
  );
}

// ---------- Cenários ----------

type Rates = { ipca: { date: string; value: number }; selic: { date: string; value: number } };

function ScenarioEditor({ planId, scenario, rates, onDone }: { planId: string; scenario: Scenario | null; rates: Rates | null; onDone: () => void }) {
  const [s, setS] = useState<Omit<Scenario, "id"> & { id?: string }>(
    scenario ?? {
      name: "Novo cenário",
      color: "#9333ea",
      revenueGrowth: 0,
      expenseGrowth: 0,
      inflation: rates?.ipca.value ?? 4.5,
      investmentReturn: rates?.selic.value ?? 10,
      horizonMonths: 12,
      events: [],
    },
  );
  const [pending, startTransition] = useTransition();
  const num = (v: number) => String(v).replace(".", ",");
  const parse = (t: string) => Number(t.replace(",", ".")) || 0;
  const field = (key: "revenueGrowth" | "expenseGrowth" | "inflation" | "investmentReturn", label: string, hint?: React.ReactNode) => (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <Input key={`${key}-${s[key]}`} defaultValue={num(s[key])} inputMode="decimal" onBlur={(e) => setS({ ...s, [key]: parse(e.target.value) })} />
      {hint}
    </div>
  );

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          if (toastResult(await saveScenario(planId, s), "Cenário salvo.")) onDone();
        });
      }}
    >
      <div className="grid grid-cols-[1fr_3.5rem_7rem] gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">Nome</Label>
          <Input value={s.name} maxLength={60} onChange={(e) => setS({ ...s, name: e.target.value })} required />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Cor</Label>
          <Input type="color" value={s.color} onChange={(e) => setS({ ...s, color: e.target.value })} className="h-9 p-1" />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Horizonte (meses)</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={s.horizonMonths}
            onChange={(e) => setS({ ...s, horizonMonths: Math.min(120, Math.max(1, Math.floor(Number(e.target.value)) || 1)) })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {field("revenueGrowth", "Crescimento das receitas (% a.a.)")}
        {field("expenseGrowth", "Crescimento real das despesas (% a.a.)")}
        {field(
          "inflation",
          "Inflação (% a.a.)",
          rates && (
            <button type="button" className="text-left text-xs text-primary hover:underline" onClick={() => setS({ ...s, inflation: rates.ipca.value })}>
              Usar IPCA 12m: {num(rates.ipca.value)}%
            </button>
          ),
        )}
        {field(
          "investmentReturn",
          "Rendimento das aplicações (% a.a.)",
          rates && (
            <button type="button" className="text-left text-xs text-primary hover:underline" onClick={() => setS({ ...s, investmentReturn: rates.selic.value })}>
              Usar Selic: {num(rates.selic.value)}%
            </button>
          ),
        )}
      </div>
      <div className="grid gap-2">
        <Label className="text-xs">Eventos pontuais (valor positivo entra no caixa, negativo sai)</Label>
        {s.events.map((ev, i) => (
          <div key={i} className="grid grid-cols-[8.5rem_1fr_9rem_auto] gap-2">
            <Input
              type="month"
              value={ev.month}
              onChange={(e) => setS({ ...s, events: s.events.map((x, j) => (j === i ? { ...x, month: e.target.value } : x)) })}
              aria-label="Mês"
            />
            <Input
              value={ev.description}
              maxLength={120}
              placeholder="Ex.: 13º salário, compra de veículo"
              onChange={(e) => setS({ ...s, events: s.events.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })}
              aria-label="Descrição"
            />
            <Input
              defaultValue={ev.cents ? (ev.cents / 100).toLocaleString("pt-BR") : ""}
              inputMode="decimal"
              placeholder="-5.000,00"
              className="text-right tabular-nums"
              onBlur={(e) => {
                const v = Number(e.target.value.replace(/\./g, "").replace(",", "."));
                setS({ ...s, events: s.events.map((x, j) => (j === i ? { ...x, cents: Number.isFinite(v) ? Math.round(v * 100) : 0 } : x)) });
              }}
              aria-label="Valor"
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Remover evento" onClick={() => setS({ ...s, events: s.events.filter((_, j) => j !== i) })}>
              <X />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setS({ ...s, events: [...s.events, { month: `${new Date().getFullYear() + 1}-01`, description: "", cents: 0 }] })}
          >
            <Plus /> Evento
          </Button>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          Salvar cenário
        </Button>
      </div>
    </form>
  );
}

export function ScenariosPanel({ plan }: { plan: WorkspacePlan }) {
  const { dataset, inputs } = usePlan();
  const [editing, setEditing] = useState<Scenario | "new" | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [loadingRates, startRates] = useTransition();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus /> Novo cenário
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loadingRates}
          onClick={() =>
            startRates(async () => {
              const result = await fetchBcbRates();
              if (toastResult(result) && result.ok && result.data) setRates(result.data);
            })
          }
        >
          <Download /> Buscar IPCA e Selic (Banco Central)
        </Button>
        {rates && (
          <span className="text-xs text-muted-foreground">
            IPCA 12 meses: {String(rates.ipca.value).replace(".", ",")}% ({rates.ipca.date}) · Selic meta: {String(rates.selic.value).replace(".", ",")}% (
            {rates.selic.date})
          </span>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {plan.scenarios.map((s) => (
          <div key={s.id} className="rounded-md border p-3" style={{ borderTopColor: s.color, borderTopWidth: 3 }}>
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{s.name}</div>
              <div className="flex">
                <Button variant="ghost" size="icon" className="size-7" aria-label="Editar cenário" onClick={() => setEditing(s)}>
                  <Pencil />
                </Button>
                <ConfirmAction
                  title="Excluir cenário?"
                  description={s.name}
                  onConfirm={async () => toastResult(await deleteScenario(plan.id, s.id), "Cenário excluído.")}
                >
                  <Button variant="ghost" size="icon" className="size-7" aria-label="Excluir cenário">
                    <Trash2 className="text-destructive" />
                  </Button>
                </ConfirmAction>
              </div>
            </div>
            <dl className="mt-1 grid grid-cols-2 gap-x-2 text-xs">
              <dt className="text-muted-foreground">Receitas</dt>
              <dd className="text-right tabular-nums">{s.revenueGrowth}% a.a.</dd>
              <dt className="text-muted-foreground">Despesas (real)</dt>
              <dd className="text-right tabular-nums">{s.expenseGrowth}% a.a.</dd>
              <dt className="text-muted-foreground">Inflação</dt>
              <dd className="text-right tabular-nums">{s.inflation}% a.a.</dd>
              <dt className="text-muted-foreground">Rendimento</dt>
              <dd className="text-right tabular-nums">{s.investmentReturn}% a.a.</dd>
              <dt className="text-muted-foreground">Horizonte</dt>
              <dd className="text-right tabular-nums">{s.horizonMonths} meses</dd>
              {s.events.length > 0 && (
                <>
                  <dt className="text-muted-foreground">Eventos</dt>
                  <dd className="text-right tabular-nums">{s.events.length}</dd>
                </>
              )}
            </dl>
          </div>
        ))}
      </div>
      {plan.scenarios.length > 0 && (
        <div className="rounded-md border p-3">
          <InteractiveChart
            data={chartData({ ...DEFAULT_CHART, source: "cenarios", metric: "total" }, dataset, inputs)}
            type="linhas"
            height={240}
            title="Patrimônio projetado (caixa + aplicações)"
          />
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Novo cenário" : "Editar cenário"}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <ScenarioEditor planId={plan.id} scenario={editing === "new" ? null : editing} rates={rates} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
