import { BookOpen, FileText, Scale, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getPublishedCompany } from "@/lib/public-company";
import { CompanyDashboard } from "@/reports/dashboard";

export const metadata: Metadata = { title: "Painel" };

export default async function PublicDashboardPage({ params }: PageProps<"/publico/[token]">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  const base = `/publico/${token}`;
  return (
    <CompanyDashboard
      company={company}
      title="Painel da empresa"
      shortcuts={[
        { title: "Balanço Patrimonial", href: `${base}/balanco-patrimonial`, icon: Scale, text: "Posição patrimonial" },
        { title: "Balancete", href: `${base}/balancete`, icon: BookOpen, text: "Saldos de todas as contas" },
        { title: "DRE", href: `${base}/dre`, icon: FileText, text: "Resultado do período" },
        { title: "Fluxo de caixa", href: `${base}/fluxo-de-caixa`, icon: Wallet, text: "Entradas e saídas" },
      ]}
    />
  );
}
