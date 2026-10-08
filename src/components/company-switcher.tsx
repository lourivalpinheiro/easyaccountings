"use client";

import { Building2 } from "lucide-react";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDocument, type PersonType } from "@/lib/accounting";
import { setActiveCompany } from "@/lib/company-actions";

type Option = { id: string; personType: PersonType; legalName: string; document: string };

export function CompanySwitcher({ companies, activeId }: { companies: Option[]; activeId?: string }) {
  const [pending, startTransition] = useTransition();
  if (companies.length === 0) {
    return <span className="text-sm text-muted-foreground">Nenhuma empresa cadastrada</span>;
  }
  return (
    <Select
      value={activeId}
      disabled={pending}
      onValueChange={(id) => startTransition(() => setActiveCompany(id))}
    >
      <SelectTrigger className="w-full min-w-0 max-w-80" aria-label="Empresa ativa">
        <Building2 />
        <SelectValue placeholder="Selecione a empresa" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="truncate">{c.legalName}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">{formatDocument(c.personType, c.document)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
