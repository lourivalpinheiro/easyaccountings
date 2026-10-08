"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const PUBLIC_REPORTS = [
  { title: "Balanço Patrimonial", slug: "balanco-patrimonial" },
  { title: "Balancete", slug: "balancete" },
  { title: "Livro Diário", slug: "livro-diario" },
  { title: "Livro Razão", slug: "livro-razao" },
  { title: "DRE", slug: "dre" },
  { title: "Orçado x Realizado", slug: "orcamento" },
  { title: "Fluxo de caixa", slug: "fluxo-de-caixa" },
];

/** Navegação do link público: rola horizontalmente no celular. */
export function PublicNav({ token }: { token: string }) {
  const pathname = usePathname();
  const base = `/publico/${token}`;
  const items = [{ title: "Painel", href: base }, ...PUBLIC_REPORTS.map((r) => ({ title: r.title, href: `${base}/${r.slug}` }))];
  return (
    <nav className="no-print -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0" aria-label="Relatórios">
      <ul className="flex gap-1 whitespace-nowrap">
        {items.map((item) => {
          const active = item.href === base ? pathname === base : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors md:h-8",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
