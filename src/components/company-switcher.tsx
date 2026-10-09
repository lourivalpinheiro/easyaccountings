"use client";

import { Building2, Check, ChevronsUpDown, Pin, PinOff } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDocument, type PersonType } from "@/lib/accounting";
import { setActiveCompany } from "@/lib/company-actions";
import { setPinnedCompany } from "@/app/(app)/perfil/actions";
import { normalize } from "@/lib/table-controls";
import { toastResult } from "@/lib/toast-result";
import { cn } from "@/lib/utils";

type Option = { id: string; personType: PersonType; legalName: string; displayName: string | null; document: string | null };

/** Nome exibido: nome fantasia (PJ) ou apelido (PF); sem ele, a razão social / nome. */
const shownName = (c: Option) => c.displayName?.trim() || c.legalName;

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
  const [open, setOpen] = useState(false);
  if (companies.length === 0) {
    return <span className="text-sm text-muted-foreground">Nenhuma empresa cadastrada</span>;
  }
  const isPinned = Boolean(activeId) && activeId === pinnedId;
  const active = companies.find((c) => c.id === activeId);
  const sorted = [...companies].sort((a, b) => shownName(a).localeCompare(shownName(b), "pt-BR"));
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Empresa ativa"
            disabled={pending}
            className="w-full min-w-0 max-w-80 justify-between font-normal"
          >
            <Building2 className="text-muted-foreground" />
            <span className={cn("min-w-0 flex-1 truncate text-left", !active && "text-muted-foreground")}>
              {active ? shownName(active) : "Selecione a empresa"}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(26rem,92vw)] p-0" align="start">
          <Command filter={(value, search) => (normalize(value).includes(normalize(search)) ? 1 : 0)}>
            <CommandInput placeholder="Buscar por nome fantasia, apelido, razão social ou CPF/CNPJ..." />
            <CommandList>
              <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
              <CommandGroup>
                {sorted.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${shownName(c)} ${c.legalName} ${c.document ?? ""} ${formatDocument(c.personType, c.document)} ${c.id}`}
                    onSelect={() => {
                      setOpen(false);
                      if (c.id !== activeId) startTransition(() => setActiveCompany(c.id));
                    }}
                  >
                    <div className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">{shownName(c)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[shownName(c) !== c.legalName ? c.legalName : null, formatDocument(c.personType, c.document) || null].filter(Boolean).join(" · ") ||
                          "Informal"}
                      </span>
                    </div>
                    <Check className={cn("ml-auto", c.id === activeId ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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
