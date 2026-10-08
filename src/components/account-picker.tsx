"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PickerAccount = {
  id: string;
  reducedCode: number;
  classification: string;
  name: string;
  analytic: boolean;
};

export function AccountPicker({
  accounts,
  value,
  onChange,
  placeholder = "Selecione a conta",
  className,
  allowClear,
  id,
}: {
  accounts: PickerAccount[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">
            {selected ? `${selected.reducedCode} · ${selected.classification} - ${selected.name}` : placeholder}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(32rem,90vw)] p-0" align="start">
        <Command
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Buscar por código, classificação ou nome..." />
          <CommandList>
            <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="(nenhuma)"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">(nenhuma)</span>
                </CommandItem>
              )}
              {accounts.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`${a.reducedCode} ${a.classification} ${a.name}`}
                  disabled={!a.analytic}
                  onSelect={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                >
                  <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {a.reducedCode}
                  </span>
                  <span className={cn("tabular-nums", !a.analytic && "font-semibold")}>{a.classification}</span>
                  <span className={cn("truncate", !a.analytic && "font-semibold")}>{a.name}</span>
                  <Check className={cn("ml-auto", value === a.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
