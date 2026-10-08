import { BookOpen, FileText, Scale, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getPublishedCompany } from "@/lib/public-company";
import { CompanyDashboard } from "@/reports/dashboard";

export const metadata: Metadata = { title: "Painel" };

export default async function PublicDashboardPage({ params }: PageProps<"/publico/[token]">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  const base = `/publico/${token}`;
  const allShortcuts = [
    { slug: "balanco-patrimonial", title: "Balanço Patrimonial", href: `${base}/balanco-patrimonial`, icon: Scale, text: "Posição patrimonial" },
    { slug: "balancete", title: "Balancete", href: `${base}/balancete`, icon: BookOpen, text: "Saldos de todas as contas" },
    { slug: "dre", title: "DRE", href: `${base}/dre`, icon: FileText, text: "Resultado do período" },
    { slug: "fluxo-de-caixa", title: "Fluxo de caixa", href: `${base}/fluxo-de-caixa`, icon: Wallet, text: "Entradas e saídas" },
  ];
  const shortcuts = company.publicSections
    ? allShortcuts.filter((s) => company.publicSections!.includes(s.slug))
    : allShortcuts;
  return <CompanyDashboard company={company} title="Painel da empresa" shortcuts={shortcuts} />;
}
