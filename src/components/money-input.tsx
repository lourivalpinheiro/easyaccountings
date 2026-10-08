"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatMoney, parseMoneyInput } from "@/lib/accounting";
import { cn } from "@/lib/utils";

/** Campo monetário em pt-BR que trabalha com centavos inteiros. */
export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number;
  onChange: (cents: number) => void;
}) {
  // Enquanto o campo está em foco mostra o texto digitado; fora dele, o valor formatado.
  const [text, setText] = useState<string | null>(null);
  const display = text ?? (value ? formatMoney(value) : "");

  return (
    <Input
      inputMode="decimal"
      placeholder="0,00"
      {...props}
      className={cn("text-right tabular-nums", className)}
      value={display}
      onFocus={(e) => {
        setText(value ? formatMoney(value) : "");
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.,]/g, "");
        setText(next);
        const cents = parseMoneyInput(next);
        onChange(Number.isNaN(cents) ? 0 : cents);
      }}
      onBlur={(e) => {
        setText(null);
        props.onBlur?.(e);
      }}
    />
  );
}
