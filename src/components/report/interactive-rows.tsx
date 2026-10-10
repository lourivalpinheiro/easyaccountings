"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type AccountRowsCtx = { selected: string | null; select: (id: string) => void };
const AccountRowsContext = createContext<AccountRowsCtx | null>(null);

/**
 * Envolve as linhas de contas de um relatório: o primeiro clique numa conta analítica a seleciona,
 * o segundo (já selecionada) abre o Livro Razão dela no mesmo período do relatório.
 */
export function AccountRowsGroup({ period, children }: { period: { from: string; to: string }; children: React.ReactNode }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const select = (id: string) => {
    if (selected === id) {
      router.push(`/relatorios/livro-razao?contas=${id}&de=${period.from}&ate=${period.to}`);
    } else {
      setSelected(id);
    }
  };

  return <AccountRowsContext.Provider value={{ selected, select }}>{children}</AccountRowsContext.Provider>;
}

export function AccountRow({
  accountId,
  analytic,
  className,
  children,
}: {
  accountId: string;
  analytic: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(AccountRowsContext);
  if (!analytic || !ctx) return <tr className={className}>{children}</tr>;
  const isSelected = ctx.selected === accountId;
  return (
    <tr
      className={cn(className, "cursor-pointer", isSelected && "bg-primary/10! outline -outline-offset-1 outline-primary/50")}
      onClick={() => ctx.select(accountId)}
      title={isSelected ? "Clique de novo para abrir o razão desta conta" : "Clique para selecionar"}
    >
      {children}
    </tr>
  );
}

/** Linha clicável que navega direto para `href` (usada para abrir um lançamento a partir do relatório). */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr className={cn(className, "cursor-pointer hover:bg-muted/40")} onClick={() => router.push(href)} title="Abrir lançamento">
      {children}
    </tr>
  );
}
