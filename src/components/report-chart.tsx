"use client";

import { InteractiveChart } from "@/components/interactive-chart";
import { ChartSvg } from "@/components/plan/chart-view";
import type { ChartData, ChartType } from "@/lib/plan/types";

/**
 * Gráfico de relatório: interativo na tela e vetorial na impressão/PDF
 * (o vetorial se ajusta à largura da folha, sem cortes).
 */
export function ReportChart({ data, type, title, height = 260 }: { data: ChartData; type: ChartType; title: string; height?: number }) {
  return (
    <div className="min-w-0 break-inside-avoid rounded-md border p-3 print:border-0 print:p-0">
      <div className="print:hidden">
        <InteractiveChart data={data} type={type} title={title} height={height} animate={false} />
      </div>
      <div className="hidden print:block">
        <ChartSvg data={data} type={type} title={title} height={Math.round(height * 0.85)} />
      </div>
    </div>
  );
}
