import { Building2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6 sm:gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{children}</div>}
    </div>
  );
}

export function NoCompany({ isAdmin }: { isAdmin?: boolean }) {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
      <Building2 className="size-10 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Nenhuma empresa selecionada</h2>
      <p className="text-sm text-muted-foreground">
        {isAdmin
          ? "Cadastre a primeira empresa para começar a usar o módulo contábil."
          : "Peça a um administrador para cadastrar uma empresa."}
      </p>
      {isAdmin && (
        <Button asChild>
          <Link href="/admin/empresas">Cadastrar empresa</Link>
        </Button>
      )}
    </div>
  );
}
