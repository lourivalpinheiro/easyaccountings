import {
  Activity,
  BarChart3,
  Banknote,
  BookOpen,
  BookText,
  FileText,
  FolderOpen,
  Landmark,
  PenLine,
  PiggyBank,
  Receipt,
  Scale,
} from "lucide-react";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { readMonthPeriod } from "@/lib/period";
import { CompanyDashboard, type Shortcut } from "@/reports/dashboard";

const ACCOUNTING: Shortcut[] = [
  { title: "Lançamentos", href: "/movimento/lancamentos", icon: PenLine, text: "Registrar partidas" },
  { title: "Plano de contas", href: "/arquivo/plano-de-contas", icon: FolderOpen, text: "Contas sintéticas e analíticas" },
  { title: "Balancete", href: "/relatorios/balancete", icon: BookOpen, text: "Saldos de todas as contas" },
  { title: "Balanço Patrimonial", href: "/relatorios/balanco-patrimonial", icon: Scale, text: "Posição patrimonial" },
  { title: "DRE", href: "/relatorios/dre", icon: FileText, text: "Resultado do período" },
  { title: "Livro Razão", href: "/relatorios/livro-razao", icon: BookText, text: "Movimento por conta" },
];

const FINANCE: Shortcut[] = [
  { title: "Fluxo de caixa", href: "/financeiro/fluxo-de-caixa", icon: Banknote, text: "Entradas e saídas" },
  { title: "Saúde de caixa", href: "/financeiro/saude", icon: Activity, text: "Saldo dia a dia" },
  { title: "Relatório", href: "/financeiro/relatorio", icon: Receipt, text: "Fluxo de caixa do período" },
  { title: "Orçamentos", href: "/financeiro/orcamentos", icon: PiggyBank, text: "Valores orçados" },
  { title: "Orçado x Realizado", href: "/financeiro/orcado-x-realizado", icon: BarChart3, text: "Comparação com o realizado" },
  { title: "Conciliação", href: "/utilitarios/conciliacao", icon: Landmark, text: "Extratos bancários (OFX)" },
];

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return (
    <CompanyDashboard
      company={company}
      title={`Olá, ${user.name.split(" ")[0]}`}
      period={readMonthPeriod(await searchParams)}
      accounting={ACCOUNTING}
      finance={FINANCE}
    />
  );
}
