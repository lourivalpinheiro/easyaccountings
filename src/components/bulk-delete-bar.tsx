"use client";

import { Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-utils";
import { toastResult } from "@/lib/toast-result";

/** Barra "N selecionados · Excluir selecionados", para tabelas com checkbox de seleção. */
export function BulkDeleteBar({
  count,
  onConfirm,
  onDone,
}: {
  count: number;
  onConfirm: () => Promise<ActionResult>;
  onDone: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <span>{count} selecionado(s)</span>
      <ConfirmAction
        title={`Excluir ${count} registro(s)?`}
        description="Essa ação não pode ser desfeita."
        onConfirm={async () => {
          if (toastResult(await onConfirm(), "Registros excluídos.")) onDone();
        }}
      >
        <Button variant="destructive" size="sm">
          <Trash2 /> Excluir selecionados
        </Button>
      </ConfirmAction>
    </div>
  );
}
