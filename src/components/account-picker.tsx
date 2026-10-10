"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { saveAccount } from "@/app/(app)/arquivo/actions";
import { suggestChildClassification } from "@/lib/accounting";
import { toastResult } from "@/lib/toast-result";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PickerAccount = {
  id: string;
  reducedCode: number;
  classification: string;
  name: string;
  analytic: boolean;
};

/**
 * Botão "Criar conta": cadastra uma conta analítica nova a partir de uma sintética existente, sugerindo a
 * próxima classificação livre. Usado nas telas de lançamento de todos os módulos, para não precisar sair
 * para o Plano de Contas só para cadastrar uma conta que falta.
 */
export function AccountQuickCreate({ accounts, onCreated }: { accounts: PickerAccount[]; onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const synthetics = accounts.filter((a) => !a.analytic);
  const parent = synthetics.find((a) => a.id === parentId);
  const classifications = accounts.map((a) => a.classification);
  const classification = parent ? suggestChildClassification(parent.classification, classifications) : "";

  const reset = () => {
    setParentId(null);
    setName("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus /> Criar conta
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta contábil</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Conta sintética (grupo)</Label>
            <AccountPicker
              accounts={synthetics}
              value={parentId}
              onChange={setParentId}
              placeholder="Selecione o grupo da nova conta"
            />
          </div>
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Caixa geral" autoFocus />
          </div>
          {parent && (
            <p className="text-xs text-muted-foreground">
              Classificação: <span className="tabular-nums">{classification}</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending || !classification || !name.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await saveAccount({ classification, name: name.trim(), dreCategoryId: null });
                if (toastResult(result, "Conta criada.") && result.ok) {
                  onCreated((result.data as { id: string }).id);
                  setOpen(false);
                  reset();
                }
              })
            }
          >
            {pending ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
