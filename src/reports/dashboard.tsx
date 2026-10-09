import { BookOpen, Landmark, Scale, TrendingDown, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { DashboardPeriod } from "@/components/dashboard-period";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDocument, formatMoney, PERSON_LABELS } from "@/lib/accounting";
import { getCashTotals } from "@/lib/data/cash-flow";
import { getChart, getMovements } from "@/lib/data/ledger";
import type { Company } from "@/lib/company";
import { cn } from "@/lib/utils";

export type Shortcut = { title: string; href: string; icon: LucideIcon; text: string };

type Stat = { label: string; value: number; icon: LucideIcon; hint?: string; signed?: boolean };

function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      {stats.map((s) => (
        <Card key={s.label} className="gap-1 py-4">
          <CardHeader className="flex flex-row items-center justify-between px-4">
            <CardDescription>{s.label}</CardDescription>
            <s.icon className="size-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4">
            <div className={cn("text-2xl font-semibold tabular-nums", s.signed && s.value < 0 && "text-destructive")}>
              {s.signed && s.value < 0 ? "-" : ""}
              {formatMoney(Math.abs(s.value))}
            </div>
            {s.hint && <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Shortcuts({ shortcuts }: { shortcuts: Shortcut[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {shortcuts.map((s) => (
        <Link key={s.href} href={s.href} className="group">
          <Card className="h-full gap-1 py-3 transition-colors group-hover:border-primary">
            <CardHeader className="px-3">
              <s.icon className="size-5 text-primary" />
              <CardTitle className="mt-1 text-sm">{s.title}</CardTitle>
              <CardDescription className="text-xs">{s.text}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ModuleSection({
  icon: Icon,
  title,
  description,
  stats,
  shortcuts,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  stats: Stat[];
  shortcuts: Shortcut[];
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5 text-primary" /> {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <StatCards stats={stats} />
      {shortcuts.length > 0 && <Shortcuts shortcuts={shortcuts} />}
    </section>
  );
}

/** Posição patrimonial na data: saldos acumulados das contas de Ativo, Passivo e Patrimônio Líquido. */
async function getBalancePosition(companyId: string, date: string) {
  const [chart, movements] = await Promise.all([getChart(companyId), getMovements(companyId, { to: date })]);
  const sum = (group: string, sign: 1 | -1) =>
    chart
      .filter((a) => a.analytic && a.group === group)
      .reduce((s, a) => {
        const m = movements.get(a.id);
        return s + (m ? (m.debit - m.credit) * sign : 0);
      }, 0);
  const assets = sum("ativo", 1);
  const liabilities = sum("passivo", -1);
  const equity = sum("patrimonio_liquido", -1);
  // Ativo - (Passivo + PL): resultado do exercício ainda não zerado.
  return { assets, liabilities, equity, unclosed: assets - liabilities - equity };
}

/**
 * Painel da empresa por módulo (usado no sistema e no link público): indicadores e atalhos.
 * Um módulo só aparece quando recebe a lista de atalhos.
 */
export async function CompanyDashboard({
  company,
  title,
  period,
  accounting,
  finance,
}: {
  company: Company;
  title: string;
  /** Período das informações (padrão das páginas: mês atual completo). */
  period: { from: string; to: string };
  accounting?: Shortcut[];
  finance?: Shortcut[];
}) {
  const [position, cash] = await Promise.all([
    accounting ? getBalancePosition(company.id, period.to) : null,
    finance ? getCashTotals(company.id, period) : null,
  ]);

  const revenues = cash?.byType.entrada ?? 0;
  const expenses = (cash?.byType.saida ?? 0) + (cash?.byType.cartao_credito ?? 0);
  const profit = revenues - expenses;

  return (
    <>
      <PageHeader
        title={title}
        description={
          company.document
            ? `${company.legalName} · ${PERSON_LABELS[company.personType].document} ${formatDocument(company.personType, company.document)}`
            : `${company.legalName} · Informal`
        }
      />
      <div className="grid gap-8">
        <DashboardPeriod period={period} />
        {position && accounting && (
          <ModuleSection
            icon={BookOpen}
            title="Módulo Contábil"
            description={`Posição patrimonial em ${formatDate(period.to)}.`}
            stats={[
              { label: "Ativo", value: position.assets, icon: Landmark, signed: true },
              { label: "Passivo", value: position.liabilities, icon: Scale, signed: true },
              {
                label: "Patrimônio Líquido",
                value: position.equity,
                icon: Wallet,
                signed: true,
                hint:
                  position.unclosed !== 0
                    ? `Resultado do exercício ainda não zerado: ${position.unclosed < 0 ? "-" : ""}${formatMoney(Math.abs(position.unclosed))}`
                    : undefined,
              },
            ]}
            shortcuts={accounting}
          />
        )}
        {cash && finance && (
          <ModuleSection
            icon={Wallet}
            title="Módulo Financeiro"
            description={`Fluxo de caixa de ${formatDate(period.from)} a ${formatDate(period.to)}.`}
            stats={[
              { label: "Receitas", value: revenues, icon: TrendingUp, hint: "Entradas no caixa" },
              { label: "Despesas", value: expenses, icon: TrendingDown, hint: "Saídas e cartão de crédito" },
              {
                label: profit >= 0 ? "Lucro" : "Prejuízo",
                value: profit,
                icon: profit >= 0 ? TrendingUp : TrendingDown,
                signed: true,
                hint: cash.byType.economia ? `Economias no período (não entram como despesa): ${formatMoney(cash.byType.economia)}` : undefined,
              },
            ]}
            shortcuts={finance}
          />
        )}
      </div>
    </>
  );
}
