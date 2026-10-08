import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { PeriodLockClient } from "./period-lock-client";

export const metadata: Metadata = { title: "Fechamento de período" };

export default async function PeriodLockPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return (
    <>
      <PageHeader
        title="Fechamento de período"
        description="Bloqueia novos lançamentos (contábeis e financeiros) em datas iguais ou anteriores à informada."
      />
      <PeriodLockClient lockedUntil={company.periodLockedUntil} isAdmin={user.role === "admin"} />
    </>
  );
}
