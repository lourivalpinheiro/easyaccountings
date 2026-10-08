"use client";

import { useRouter } from "next/navigation";
import { ReportFilters } from "@/components/report-filters";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/accounting";

type BudgetOption = { id: string; name: string; startDate: string; endDate: string };

export function BudgetFilters({
  budgets,
  budgetId,
  period,
}: {
  budgets: BudgetOption[];
  budgetId: string;
  period: { from: string; to: string };
}) {
  const router = useRouter();
  return (
    <ReportFilters key={budgetId} period={period} extraParams={{ orcamento: budgetId }}>
      <div className="grid gap-1.5">
        <Label>Orçamento</Label>
        <Select value={budgetId} onValueChange={(id) => router.push(`?orcamento=${id}`)}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {budgets.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name} ({formatDate(b.startDate)} a {formatDate(b.endDate)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ReportFilters>
  );
}
