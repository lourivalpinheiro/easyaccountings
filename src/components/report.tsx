import Image from "next/image";
import { formatDate, formatDocument, formatNowBrasilia, PERSON_LABELS } from "@/lib/accounting";
import type { Company } from "@/lib/company";
import { LOGOS_BUCKET, publicUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Marca no topo do relatório: a logo da própria empresa, se enviada, senão a Nedemy (clara/escura conforme o tema; na impressão sempre a clara). */
function ReportLogo({ company }: { company: Company }) {
  if (company.logoPath) {
    // eslint-disable-next-line @next/next/no-img-element -- logo enviada pelo usuário, não otimizável pelo next/image.
    return <img src={publicUrl(LOGOS_BUCKET, company.logoPath)} alt={company.legalName} className="mx-auto mb-3 h-16 w-auto object-contain" />;
  }
  return (
    <span className="relative mx-auto mb-3 block h-16 w-32">
      <Image
        src="/brand/nedemy-vertical.png"
        alt="Nedemy"
        width={746}
        height={370}
        className="report-logo-light mx-auto h-full w-auto object-contain dark:hidden"
        unoptimized
      />
      <Image
        src="/brand/nedemy-vertical-white.png"
        alt="Nedemy"
        width={747}
        height={371}
        className="report-logo-dark mx-auto hidden h-full w-auto object-contain dark:block"
        unoptimized
      />
    </span>
  );
}

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
    <article className="print-area rounded-lg border bg-card p-3 text-card-foreground sm:p-6 shadow-sm">
      <header className="mb-4 grid gap-0.5 border-b pb-3 text-sm">
        <div>
          <span className="text-muted-foreground">{PERSON_LABELS[company.personType].name}: </span>
          <strong>{company.legalName}</strong>
        </div>
        {company.document && (
          <div>
            <span className="text-muted-foreground">{PERSON_LABELS[company.personType].document}: </span>
            {formatDocument(company.personType, company.document)}
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Período: </span>
          {formatDate(period.from)} a {formatDate(period.to)}
        </div>
      </header>
      <ReportLogo company={company} />
      <h2 className="mb-4 text-center text-base font-bold sm:text-lg tracking-wide uppercase">{title}</h2>
      <div className="overflow-x-auto print:overflow-visible">{children}</div>
      <footer className="mt-6 text-right text-xs text-muted-foreground">
        Emitido em {formatNowBrasilia()} · Nedemy Finanças
      </footer>
    </article>
  );
}

export function ReportTable({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      className={cn("report-table w-full border-collapse text-[13px] [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1.5", className)}
      {...props}
    />
  );
}

/** Nome/descrição de conta: não quebra linha, para manter o alinhamento das colunas de valor mesmo em nomes longos. */
export const accountName = "whitespace-nowrap";

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("border-b-2 border-foreground/70 text-left font-semibold", className)} {...props} />;
}

export const num = "text-right tabular-nums whitespace-nowrap";

export function EmptyReport({ children = "Nenhum dado encontrado para o período." }: { children?: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
