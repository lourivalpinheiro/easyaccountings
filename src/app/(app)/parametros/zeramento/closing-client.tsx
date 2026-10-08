"use client";

import { Play, Save, Search, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AccountPicker, type PickerAccount } from "@/components/account-picker";
import { ConfirmAction } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { TablePagination, usePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBalance, formatDate, formatMoney } from "@/lib/accounting";
import { toastResult } from "@/lib/toast-result";
import { revertClosing, runClosing, saveClosingSettings } from "../actions";

type Settings = { resultAccountId: string | null; profitAccountId: string | null; lossAccountId: string | null };
type PreviewRow = { id: string; classification: string; name: string; group: string; balance: number };
type Batch = { id: string; startDate: string; endDate: string; netResult: number; createdAt: string };

export function ClosingClient({
  period,
  settings: initial,
  apuracaoAccounts,
  equityAccounts,
  preview,
  batches,
}: {
  period: { from: string; to: string };
  settings: Settings;
  apuracaoAccounts: PickerAccount[];
  equityAccounts: PickerAccount[];
  preview: PreviewRow[];
  batches: Batch[];
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [pending, startTransition] = useTransition();
  const previewPage = usePagination(preview);
  const batchPage = usePagination(batches, 10);
  const result = -preview.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Contas do zeramento</CardTitle>
          <CardDescription>Conta intermediária de apuração e contas do Patrimônio Líquido que recebem o resultado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label>Conta de apuração do resultado</Label>
            <AccountPicker accounts={apuracaoAccounts} value={settings.resultAccountId} onChange={(id) => setSettings((s) => ({ ...s, resultAccountId: id }))} />
          </div>
          <div className="grid gap-2">
            <Label>Conta de PL que recebe lucros</Label>
            <AccountPicker accounts={equityAccounts} value={settings.profitAccountId} onChange={(id) => setSettings((s) => ({ ...s, profitAccountId: id }))} />
          </div>
          <div className="grid gap-2">
            <Label>Conta de PL que recebe prejuízos</Label>
            <AccountPicker accounts={equityAccounts} value={settings.lossAccountId} onChange={(id) => setSettings((s) => ({ ...s, lossAccountId: id }))} />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            disabled={pending}
            onClick={() => startTransition(async () => void toastResult(await saveClosingSettings(settings), "Contas salvas."))}
          >
            <Save /> Salvar contas
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Executar zeramento</CardTitle>
          <CardDescription>Os lançamentos serão gerados na data final do período.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
            <div className="grid gap-2">
              <Label htmlFor="from">De</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">Até</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button variant="outline" className="col-span-2 sm:col-span-1" onClick={() => router.push(`?de=${from}&ate=${to}`)}>
              <Search /> Visualizar saldos
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classificação</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="text-right">Saldo a zerar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Nenhuma conta de resultado com saldo entre {formatDate(period.from)} e {formatDate(period.to)}.
                  </TableCell>
                </TableRow>
              )}
              {previewPage.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums">{r.classification}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBalance(r.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {preview.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>{result >= 0 ? "Lucro do período" : "Prejuízo do período"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(Math.abs(result))}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
          <TablePagination {...previewPage.pagination} />
        </CardContent>
        <CardFooter className="justify-end">
          <ConfirmAction
            title="Executar zeramento?"
            description={`Serão gerados lançamentos de encerramento em ${formatDate(period.to)} para o período de ${formatDate(period.from)} a ${formatDate(period.to)}.`}
            confirmLabel="Executar"
            onConfirm={async () => {
              const r = await runClosing({ startDate: period.from, endDate: period.to });
              toastResult(r, "Zeramento executado.");
            }}
          >
            <Button disabled={preview.length === 0 || from !== period.from || to !== period.to}>
              <Play /> Executar zeramento
            </Button>
          </ConfirmAction>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zeramentos realizados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="hidden md:table-cell">Executado em</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum zeramento realizado.
                  </TableCell>
                </TableRow>
              )}
              {batchPage.rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    {formatDate(b.startDate)} a {formatDate(b.endDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.netResult >= 0 ? "default" : "destructive"}>
                      {b.netResult >= 0 ? "Lucro" : "Prejuízo"} {formatMoney(Math.abs(b.netResult))}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{new Date(b.createdAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <ConfirmAction
                      title="Estornar zeramento?"
                      description="Os lançamentos gerados por este zeramento serão excluídos."
                      confirmLabel="Estornar"
                      onConfirm={async () => toastResult(await revertClosing(b.id), "Zeramento estornado.")}
                    >
                      <Button variant="ghost" size="sm">
                        <Undo2 /> Estornar
                      </Button>
                    </ConfirmAction>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination {...batchPage.pagination} />
        </CardContent>
      </Card>
    </div>
  );
}
