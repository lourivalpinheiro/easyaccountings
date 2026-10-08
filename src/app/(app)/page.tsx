import { BookOpen, FileText, FolderOpen, PenLine } from "lucide-react";
import { NoCompany } from "@/components/page-header";
import { getPageContext } from "@/lib/page-context";
import { CompanyDashboard, type Shortcut } from "@/reports/dashboard";

const SHORTCUTS: Shortcut[] = [
  { title: "Lançamentos", href: "/movimento/lancamentos", icon: PenLine, text: "Registrar movimentações" },
  { title: "Plano de contas", href: "/arquivo/plano-de-contas", icon: FolderOpen, text: "Contas sintéticas e analíticas" },
  { title: "Balancete", href: "/relatorios/balancete", icon: BookOpen, text: "Saldos de todas as contas" },
  { title: "DRE", href: "/relatorios/dre", icon: FileText, text: "Resultado do período" },
];

export default async function HomePage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  return <CompanyDashboard company={company} title={`Olá, ${user.name.split(" ")[0]}`} shortcuts={SHORTCUTS} />;
}
