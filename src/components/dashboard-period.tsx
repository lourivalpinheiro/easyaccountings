"use client";

import { usePathname, useRouter } from "next/navigation";
import { PeriodPicker } from "@/components/period-presets";

/** Período das informações do painel (padrão: mês atual completo). */
export function DashboardPeriod({ period }: { period: { from: string; to: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  return <PeriodPicker className="no-print" value={period} onChange={(p) => router.push(`${pathname}?de=${p.from}&ate=${p.to}`)} />;
}
