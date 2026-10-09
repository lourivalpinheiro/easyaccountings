import { BarChart3, BookOpen, BookText, FileText, NotebookPen, Scale, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getPublishedCompany } from "@/lib/public-company";
import { CompanyDashboard, type Shortcut } from "@/reports/dashboard";

export const metadata: Metadata = { title: "Painel" };

export default async function PublicDashboardPage({ params }: PageProps<"/publico/[token]">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  const base = `/publico/${token}`;
  const visible = (s: Shortcut & { slug: string }) => !company.publicSections || company.publicSections.includes(s.slug);

  const accounting = [
    { slug: "balanco-patrimonial", title: "Balanço Patrimonial", href: `${base}/balanco-patrimonial`, icon: Scale, text: "Posição patrimonial" },
    { slug: "balancete", title: "Balancete", href: `${base}/balancete`, icon: BookOpen, text: "Saldos de todas as contas" },
    { slug: "dre", title: "DRE", href: `${base}/dre`, icon: FileText, text: "Resultado do período" },
    { slug: "livro-diario", title: "Livro Diário", href: `${base}/livro-diario`, icon: NotebookPen, text: "Lançamentos por data" },
    { slug: "livro-razao", title: "Livro Razão", href: `${base}/livro-razao`, icon: BookText, text: "Movimento por conta" },
  ].filter(visible);
  const finance = [
    { slug: "fluxo-de-caixa", title: "Fluxo de caixa", href: `${base}/fluxo-de-caixa`, icon: Wallet, text: "Entradas e saídas" },
    { slug: "orcamento", title: "Orçado x Realizado", href: `${base}/orcamento`, icon: BarChart3, text: "Comparação com o realizado" },
  ].filter(visible);

  // Os indicadores de um módulo só aparecem se algum relatório dele foi liberado no link público.
  return (
    <CompanyDashboard
      company={company}
      title="Painel da empresa"
      accounting={accounting.length > 0 ? accounting : undefined}
      finance={finance.length > 0 ? finance : undefined}
    />
  );
}
