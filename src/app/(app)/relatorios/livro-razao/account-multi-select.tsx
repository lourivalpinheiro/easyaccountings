"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import type { PickerAccount } from "@/components/account-picker";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReportFilters } from "@/components/report-filters";
import { cn } from "@/lib/utils";

/** Filtros do Livro Razão: período + seleção de uma ou mais contas. */
export function LedgerFilters({
  period,
  accounts,
  selected: initial,
}: {
  period: { from: string; to: string };
  accounts: PickerAccount[];
  selected: string[];
}) {
  const [selected, setSelected] = useState(initial);
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <ReportFilters period={period} extraParams={{ contas: selected.join(",") || undefined }}>
      <div className="grid gap-1.5">
        <Label>Contas</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal sm:w-72">
              <span className="truncate">
                {selected.length === 0
                  ? "Selecione as contas"
                  : selected.length === 1
                    ? accounts.find((a) => a.id === selected[0])?.name
                    : `${selected.length} contas selecionadas`}
              </span>
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(32rem,90vw)] p-0" align="start">
            <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
              <CommandInput placeholder="Buscar conta..." />
              <CommandList>
                <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="(limpar seleção)" onSelect={() => setSelected([])}>
                    <span className="text-muted-foreground">Limpar seleção</span>
                  </CommandItem>
                  {accounts.map((a) => (
                    <CommandItem key={a.id} value={`${a.reducedCode} ${a.classification} ${a.name}`} onSelect={() => toggle(a.id)}>
                      <Check className={cn(selected.includes(a.id) ? "opacity-100" : "opacity-0")} />
                      <span className={cn("tabular-nums", !a.analytic && "font-semibold")}>{a.classification}</span>
                      <span className={cn("truncate", !a.analytic && "font-semibold")}>{a.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </ReportFilters>
  );
}
