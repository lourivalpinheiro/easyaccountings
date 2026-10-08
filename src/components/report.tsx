import { formatDate, formatDocument, PERSON_LABELS } from "@/lib/accounting";
import type { Company } from "@/lib/company";
import { cn } from "@/lib/utils";

/** Folha do relatório: dados da empresa, período e nome do relatório. */
export function ReportSheet({
  company,
  title,
  period,
  children,
}: {
  company: Company;
  title: string;
  period: { from: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <article className="print-area overflow-x-auto rounded-lg border bg-card p-6 text-card-foreground shadow-sm print:overflow-visible">
      <header className="mb-4 grid gap-0.5 border-b pb-3 text-sm">
        <div>
          <span className="text-muted-foreground">{PERSON_LABELS[company.personType].name}: </span>
          <strong>{company.legalName}</strong>
        </div>
        <div>
          <span className="text-muted-foreground">{PERSON_LABELS[company.personType].document}: </span>
          {formatDocument(company.personType, company.document)}
        </div>
        <div>
          <span className="text-muted-foreground">Período: </span>
          {formatDate(period.from)} a {formatDate(period.to)}
        </div>
      </header>
      <h2 className="mb-4 text-center text-lg font-bold tracking-wide uppercase">{title}</h2>
      {children}
      <footer className="mt-6 text-right text-xs text-muted-foreground">
        Emitido em {new Date().toLocaleString("pt-BR")} · Easy Accountings
      </footer>
    </article>
  );
}

export function ReportTable({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("report-table w-full border-collapse text-sm [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1.5", className)} {...props} />;
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("border-b-2 border-foreground/70 text-left font-semibold", className)} {...props} />;
}

export const num = "text-right tabular-nums whitespace-nowrap";

export function EmptyReport({ children = "Nenhum dado encontrado para o período." }: { children?: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
