"use client";

import { Check, ChevronDown, FileDown, History, Lock, RotateCcw, Save, Settings2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ConfirmAction } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { PlanEditor } from "@/components/plan/plan-editor";
import { PlanProvider } from "@/components/plan/plan-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/accounting";
import {
  PLAN_SECTION_LABELS,
  PLAN_SECTIONS,
  sectionHasContent,
  type DocNode,
  type PlanDataset,
  type PlanInputs,
  type PlanSection,
} from "@/lib/plan/types";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";
import { deletePlan, deleteVersion, restoreVersion, saveVersion, updatePlanMeta } from "./actions";
import { BudgetPanel, DiagnosisPanel, GoalsPanel, ScenariosPanel } from "./section-panels";

export type WorkspacePlan = Pick<PlanInputs, "title" | "diagnosisFrom" | "diagnosisTo" | "budget" | "goals" | "scenarios"> & {
  id: string;
  year: number;
  content: DocNode | undefined;
  /** Conteúdo de todas as seções, usado só para saber quais já têm algo preenchido (marcos de progresso). */
  allContent: Partial<Record<PlanSection, DocNode>>;
};
type Version = { id: string; number: number; label: string; createdAt: string };

function VersionsDialog({ plan, versions, open, onClose }: { plan: WorkspacePlan; versions: Version[]; open: boolean; onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Versões do plano</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await saveVersion(plan.id, label);
              if (toastResult(result, `Versão ${result.ok ? result.data?.number : ""} salva.`)) setLabel("");
            });
          }}
        >
          <Input
            value={label}
            maxLength={120}
            placeholder="Descrição da versão (ex.: aprovado na reunião de março)"
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" disabled={pending}>
            <Save /> Salvar versão atual
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          A versão guarda o texto, o orçamento, as metas, os cenários e os números do sistema naquele momento. Restaurar uma
          versão guarda antes o estado atual como uma nova versão.
        </p>
        <div className="grid max-h-[50vh] gap-2 overflow-y-auto">
          {versions.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma versão salva ainda.</p>}
          {versions.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  Versão {v.number} · {v.label}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={`/financeiro/planejamento/${plan.year}/pdf?versao=${v.id}`} target="_blank" rel="noreferrer">
                  <FileDown /> PDF
                </a>
              </Button>
              <ConfirmAction
                title={`Restaurar a versão ${v.number}?`}
                description="O plano volta ao texto, orçamento, metas e cenários dessa versão. O estado atual é salvo antes como nova versão."
                confirmLabel="Restaurar"
                onConfirm={async () => toastResult(await restoreVersion(plan.id, v.id), `Versão ${v.number} restaurada.`)}
              >
                <Button size="sm" variant="outline">
                  <RotateCcw /> Restaurar
                </Button>
              </ConfirmAction>
              <ConfirmAction
                title={`Excluir a versão ${v.number}?`}
                description={v.label}
                onConfirm={async () => toastResult(await deleteVersion(plan.id, v.id), "Versão excluída.")}
              >
                <Button size="icon" variant="ghost" aria-label="Excluir versão">
                  <Trash2 className="text-destructive" />
                </Button>
              </ConfirmAction>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ plan, open, onClose }: { plan: WorkspacePlan; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(plan.title);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const result = await updatePlanMeta(plan.id, { title, diagnosisFrom: plan.diagnosisFrom, diagnosisTo: plan.diagnosisTo });
              if (toastResult(result, "Plano atualizado.")) onClose();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Configurações do plano {plan.year}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="plan-title-edit">Título (capa do PDF)</Label>
            <Input id="plan-title-edit" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <DialogFooter className="sm:justify-between">
            <ConfirmAction
              title={`Excluir o plano de ${plan.year}?`}
              description="O texto, o orçamento, as metas, os cenários e todas as versões salvas serão excluídos."
              onConfirm={async () => {
                if (toastResult(await deletePlan(plan.id), "Plano excluído.")) router.push("/financeiro/planejamento");
              }}
            >
              <Button type="button" variant="ghost" className="text-destructive">
                <Trash2 /> Excluir plano
              </Button>
            </ConfirmAction>
            <Button type="submit" disabled={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Progresso do plano: marcos (bolinhas) ligados por linhas, preenchidos à medida que cada seção é concluída.
 * As próximas etapas só liberam depois que a anterior é concluída.
 */
function SectionStepper({
  section,
  completed,
  unlockedIndex,
  navigating,
  onNavigate,
}: {
  section: PlanSection;
  completed: Set<PlanSection>;
  unlockedIndex: number;
  navigating: boolean;
  onNavigate: (s: PlanSection) => void;
}) {
  return (
    <nav aria-label="Progresso do plano" className="w-full">
      <ol className="flex items-start">
        {PLAN_SECTIONS.map((s, i) => {
          const done = completed.has(s);
          const current = s === section;
          const locked = i > unlockedIndex;
          const last = i === PLAN_SECTIONS.length - 1;
          return (
            <li key={s} className={cn("flex items-center", !last && "flex-1")}>
              <button
                type="button"
                onClick={() => onNavigate(s)}
                disabled={navigating || locked}
                aria-current={current ? "step" : undefined}
                title={locked ? `Conclua ${PLAN_SECTION_LABELS[PLAN_SECTIONS[i - 1]].title} antes` : PLAN_SECTION_LABELS[s].title}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : current
                        ? "border-primary bg-background text-primary"
                        : locked
                          ? "cursor-not-allowed border-muted-foreground/20 bg-background text-muted-foreground/50"
                          : "border-muted-foreground/30 bg-background text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : locked ? <Lock className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {PLAN_SECTION_LABELS[s].title}
                </span>
              </button>
              {!last && <div className={cn("mx-1.5 h-0.5 flex-1 rounded-full transition-colors", done ? "bg-primary" : "bg-muted-foreground/20")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const PANEL_TITLES: Record<PlanSection, string> = {
  diagnostico: "Período analisado",
  planejamento: "Metas",
  orcamentos: "Valores orçados",
  cenarios: "Premissas dos cenários",
};

export function PlanWorkspace({
  section,
  plan,
  dataset,
  investments,
  versions,
}: {
  section: PlanSection;
  plan: WorkspacePlan;
  dataset: PlanDataset;
  investments: { id: string; name: string; active: boolean }[];
  versions: Version[];
}) {
  const router = useRouter();
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const [dialog, setDialog] = useState<"versions" | "settings" | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [navigating, startNavigation] = useTransition();
  const inputs = { budget: plan.budget, goals: plan.goals, scenarios: plan.scenarios };

  const completed = new Set<PlanSection>(
    PLAN_SECTIONS.filter((s) => {
      if (s === "planejamento") return plan.goals.length > 0 || sectionHasContent(plan.allContent[s]);
      if (s === "orcamentos") return plan.budget.length > 0 || sectionHasContent(plan.allContent[s]);
      if (s === "cenarios") return plan.scenarios.length > 0 || sectionHasContent(plan.allContent[s]);
      return sectionHasContent(plan.allContent[s]);
    }),
  );
  // Só libera a próxima etapa depois que a anterior estiver concluída.
  const firstIncomplete = PLAN_SECTIONS.findIndex((s) => !completed.has(s));
  const unlockedIndex = firstIncomplete === -1 ? PLAN_SECTIONS.length - 1 : firstIncomplete;

  // Grava o texto pendente antes de trocar de seção (a próxima seção é carregada do banco).
  const goTo = (s: PlanSection) => {
    if (PLAN_SECTIONS.indexOf(s) > unlockedIndex) return;
    startNavigation(async () => {
      await flushRef.current?.();
      router.push(`/financeiro/planejamento/${plan.year}/${s}`);
    });
  };

  return (
    <PlanProvider value={{ planId: plan.id, dataset, inputs }}>
      <PageHeader title={plan.title} description={`Plano financeiro de ${plan.year} · ${PLAN_SECTION_LABELS[section].description}`} />
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start gap-3">
          <SectionStepper section={section} completed={completed} unlockedIndex={unlockedIndex} navigating={navigating} onNavigate={goTo} />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialog("settings")}>
              <Settings2 /> Plano
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialog("versions")}>
              <History /> Versões ({versions.length})
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await flushRef.current?.();
                window.open(`/financeiro/planejamento/${plan.year}/pdf`, "_blank", "noreferrer");
              }}
            >
              <FileDown /> Exportar PDF
            </Button>
          </div>
        </div>

        <Collapsible open={panelOpen} onOpenChange={setPanelOpen}>
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CollapsibleTrigger className="flex items-center justify-between gap-2 text-left">
                <div>
                  <CardTitle className="text-base">{PANEL_TITLES[section]}</CardTitle>
                  <CardDescription>
                    {section === "diagnostico"
                      ? `De ${formatDate(plan.diagnosisFrom)} a ${formatDate(plan.diagnosisTo)}.`
                      : "Dados usados pelos gráficos e blocos do texto desta seção."}
                  </CardDescription>
                </div>
                <ChevronDown className={cn("size-4 shrink-0 transition-transform", panelOpen && "rotate-180")} />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="px-4">
                {section === "diagnostico" && <DiagnosisPanel plan={plan} />}
                {section === "planejamento" && <GoalsPanel plan={plan} investments={investments} />}
                {section === "orcamentos" && <BudgetPanel plan={plan} />}
                {section === "cenarios" && <ScenariosPanel plan={plan} />}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <PlanEditor key={section} section={section} initial={plan.content} flushRef={flushRef} />
      </div>
      {dialog === "versions" && <VersionsDialog plan={plan} versions={versions} open onClose={() => setDialog(null)} />}
      {dialog === "settings" && <SettingsDialog plan={plan} open onClose={() => setDialog(null)} />}
    </PlanProvider>
  );
}
