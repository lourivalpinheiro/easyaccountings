"use client";

import { Building2, Pin, PinOff } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDocument, type PersonType } from "@/lib/accounting";
import { setActiveCompany } from "@/lib/company-actions";
import { setPinnedCompany } from "@/app/(app)/perfil/actions";
import { toastResult } from "@/lib/toast-result";

type Option = { id: string; personType: PersonType; legalName: string; document: string | null };

export function CompanySwitcher({
  companies,
  activeId,
  pinnedId,
}: {
  companies: Option[];
  activeId?: string;
  pinnedId?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [pinPending, startPinTransition] = useTransition();
  if (companies.length === 0) {
    return <span className="text-sm text-muted-foreground">Nenhuma empresa cadastrada</span>;
  }
  const isPinned = Boolean(activeId) && activeId === pinnedId;
  return (
    <div className="flex min-w-0 items-center gap-1">
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
      {activeId && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={pinPending}
          title={isPinned ? "Não abrir esta empresa automaticamente" : "Abrir esta empresa automaticamente ao entrar"}
          aria-label={isPinned ? "Desfixar empresa" : "Fixar empresa"}
          onClick={() =>
            startPinTransition(async () => {
              toastResult(await setPinnedCompany(isPinned ? null : activeId!), isPinned ? "Empresa desfixada." : "Empresa fixada.");
            })
          }
        >
          {isPinned ? <Pin className="fill-primary text-primary" /> : <PinOff />}
        </Button>
      )}
    </div>
  );
}
