"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PUBLIC_SECTIONS } from "@/lib/public-sections";
import { cn } from "@/lib/utils";

/** Navegação do link público: rola horizontalmente no celular. */
export function PublicNav({ token, sections }: { token: string; sections: string[] | null }) {
  const pathname = usePathname();
  const base = `/publico/${token}`;
  const reports = sections ? PUBLIC_SECTIONS.filter((r) => sections.includes(r.slug)) : PUBLIC_SECTIONS;
  const items = [{ title: "Painel", href: base }, ...reports.map((r) => ({ title: r.title, href: `${base}/${r.slug}` }))];
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
