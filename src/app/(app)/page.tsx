import { and, count, eq, gte, lte } from "drizzle-orm";
import { BookOpen, FileText, FolderOpen, PenLine, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { NoCompany, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { formatDocument, formatMoney, PERSON_LABELS } from "@/lib/accounting";
import { getChart, getMovements } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { todayIso, yearStartIso } from "@/lib/period";

const SHORTCUTS = [
  { title: "Lançamentos", href: "/movimento/lancamentos", icon: PenLine, text: "Registrar movimentações" },
  { title: "Plano de contas", href: "/arquivo/plano-de-contas", icon: FolderOpen, text: "Contas sintéticas e analíticas" },
  { title: "Balancete", href: "/relatorios/balancete", icon: BookOpen, text: "Saldos de todas as contas" },
  { title: "DRE", href: "/relatorios/dre", icon: FileText, text: "Resultado do período" },
];

export default async function HomePage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;

  const from = yearStartIso();
  const to = todayIso();
  const [chart, movements, [{ entries }]] = await Promise.all([
    getChart(company.id),
    getMovements(company.id, { from, to, excludeClosing: true }),
    db
      .select({ entries: count() })
      .from(journalEntries)
      .where(and(eq(journalEntries.companyId, company.id), gte(journalEntries.date, from), lte(journalEntries.date, to))),
  ]);

  const sumGroup = (group: string) =>
    chart
      .filter((a) => a.analytic && a.group === group)
      .reduce((s, a) => {
        const m = movements.get(a.id);
        return s + (m ? m.credit - m.debit : 0);
      }, 0);
  const revenues = sumGroup("receita");
  const expenses = -sumGroup("despesa");
  const result = revenues - expenses;

  const stats = [
    { label: "Receitas no ano", value: formatMoney(revenues), icon: TrendingUp },
    { label: "Despesas no ano", value: formatMoney(expenses), icon: TrendingDown },
    { label: result >= 0 ? "Lucro no ano" : "Prejuízo no ano", value: formatMoney(Math.abs(result)), icon: result >= 0 ? TrendingUp : TrendingDown },
    { label: "Lançamentos no ano", value: String(entries), icon: PenLine },
  ];

  return (
    <>
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}`} description={`${company.legalName} · ${PERSON_LABELS[company.personType].document} ${formatDocument(company.personType, company.document)}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardDescription>{s.label}</CardDescription>
              <s.icon className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Acesso rápido</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <s.icon className="size-5 text-primary" />
                <CardTitle className="mt-2">{s.title}</CardTitle>
                <CardDescription>{s.text}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
