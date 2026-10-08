import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { getCalendarBalances, getCashBalanceBefore } from "@/lib/data/cash-flow";
import { getPageContext } from "@/lib/page-context";
import { addDaysIso, todayIso } from "@/lib/period";
import { HealthClient } from "./health-client";

export const metadata: Metadata = { title: "Saúde de caixa" };

export default async function CashHealthPage({ searchParams }: PageProps<"/financeiro/saude">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const params = await searchParams;
  const totalMonths = Math.min(24, Math.max(1, Math.floor(Number(params.meses)) || 3));

  const today = todayIso();
  const [currentBalance, months] = await Promise.all([
    getCashBalanceBefore(company.id, addDaysIso(today, 1)),
    getCalendarBalances(company.id, totalMonths),
  ]);

  let worst: { date: string; balance: number } | null = null;
  for (const month of months) {
    for (const day of month.days) {
      if (day && !day.projected && (!worst || day.balance < worst.balance)) worst = day;
    }
  }

  return (
    <>
      <PageHeader title="Saúde de caixa" description="Saldo final de cada dia: real até hoje, projetado nos meses seguintes." />
      <HealthClient totalMonths={totalMonths} currentBalance={currentBalance} worst={worst} months={months} />
    </>
  );
}
