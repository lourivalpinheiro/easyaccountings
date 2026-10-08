import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { GROUP_ORDER } from "@/lib/accounting";
import { getGroupSettings } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { NatureClient } from "./nature-client";

export const metadata: Metadata = { title: "Natureza das contas" };

export default async function NaturePage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const settings = await getGroupSettings(company.id);
  const ordered = GROUP_ORDER.map((g) => settings.find((s) => s.group === g)!).filter(Boolean);
  return (
    <>
      <PageHeader
        title="Natureza das contas"
        description="Natureza (devedora/credora) e numeração inicial de cada grupo do plano de contas."
      />
      <NatureClient settings={ordered} />
    </>
  );
}
