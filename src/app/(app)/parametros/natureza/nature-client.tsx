"use client";

import { Info, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GROUP_LABELS, MAX_LEVEL, type GroupSetting } from "@/lib/accounting";
import { toastResult } from "@/lib/toast-result";
import { saveGroupSettings } from "../actions";

export function NatureClient({ settings }: { settings: GroupSetting[] }) {
  const [rows, setRows] = useState(settings);
  const [pending, startTransition] = useTransition();
  const update = (i: number, patch: Partial<GroupSetting>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead className="w-56">Natureza</TableHead>
              <TableHead className="w-40">Numeração inicial</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.group}>
                <TableCell className="font-medium">{GROUP_LABELS[row.group]}</TableCell>
                <TableCell>
                  {row.group === "apuracao" ? (
                    <span className="text-sm text-muted-foreground">Sem natureza definida</span>
                  ) : (
                    <Select value={row.nature ?? undefined} onValueChange={(v) => update(i, { nature: v as "D" | "C" })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D">Devedora</SelectItem>
                        <SelectItem value="C">Credora</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    value={row.prefix}
                    onChange={(e) => update(i, { prefix: e.target.value })}
                    className="tabular-nums"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-4">
        <p className="flex max-w-2xl items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          O plano de contas tem {MAX_LEVEL} graus: contas sintéticas usam até 3 graus (ex.: 1. ATIVO) e somente as
          analíticas, de 4º grau, recebem lançamentos (ex.: 1.1.1.01 - Caixa geral).
        </p>
        <Button
          disabled={pending}
          onClick={() => startTransition(async () => void toastResult(await saveGroupSettings(rows), "Parâmetros salvos."))}
        >
          <Save /> Salvar
        </Button>
      </CardFooter>
    </Card>
  );
}
