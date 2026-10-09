"use client";

import { createContext, useContext } from "react";
import type { PlanDataset, PlanInputs } from "@/lib/plan/types";

export type PlanContextValue = {
  planId: string;
  dataset: PlanDataset;
  inputs: Pick<PlanInputs, "budget" | "goals" | "scenarios">;
};

const PlanContext = createContext<PlanContextValue | null>(null);

/** Dados do plano disponíveis para os gráficos e blocos inseridos no editor. */
export function PlanProvider({ value, children }: { value: PlanContextValue; children: React.ReactNode }) {
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan fora de PlanProvider");
  return ctx;
}
