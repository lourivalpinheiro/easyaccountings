import { Eye } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { getPublishedCompany } from "@/lib/public-company";
import { PublicNav } from "./public-nav";

// Links de acompanhamento não devem aparecer em buscadores.
export const metadata: Metadata = {
  title: { default: "Acompanhamento", template: "%s | Easy Accountings" },
  robots: { index: false, follow: false },
};

/** Área pública de uma empresa publicada: apenas painel e relatórios, sem lançamentos. */
export default async function PublicLayout({ children, params }: LayoutProps<"/publico/[token]">) {
  const { token } = await params;
  const company = await getPublishedCompany(token);
  return (
    <div className="flex min-h-svh flex-col">
      <header className="no-print sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
            <span className="min-w-0 flex-1 truncate font-semibold">{company.legalName}</span>
            <Badge variant="secondary" className="shrink-0">
              <Eye /> Somente leitura
            </Badge>
            <ThemeToggle />
          </div>
          <PublicNav token={token} sections={company.publicSections} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-3 sm:p-4 md:p-6">{children}</main>
    </div>
  );
}
