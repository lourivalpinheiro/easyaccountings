"use client";

import { Download, Loader2, Paperclip, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { ConfirmAction } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  deleteAttachment,
  getAttachmentUrl,
  replaceAttachment,
  setAttachmentVisibility,
  uploadAttachments,
  type EntryType,
} from "@/lib/attachments-actions";
import { toastResult } from "@/lib/toast-result";

type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number; isPublic: boolean };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsPanel({
  entryType,
  entryId,
  attachments,
  stagedRef,
}: {
  entryType: EntryType;
  entryId?: string;
  attachments: Attachment[];
  /**
   * Sem `entryId` (lançamento ainda não salvo), os arquivos escolhidos ficam pendentes aqui. Depois que o
   * lançamento é criado, o formulário chama `stagedRef.current(novoId)` para enviar o que ficou pendente.
   */
  stagedRef?: React.RefObject<((newEntryId: string) => Promise<void>) | null>;
}) {
  const [pending, startTransition] = useTransition();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [staged, setStaged] = useState<File[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const stagedInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacingId = useRef<string | null>(null);

  useEffect(() => {
    if (!stagedRef) return;
    stagedRef.current = async (newEntryId: string) => {
      if (staged.length === 0) return;
      const formData = new FormData();
      for (const f of staged) formData.append("files", f);
      await uploadAttachments(entryType, newEntryId, formData);
    };
  });

  function onUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const f of Array.from(files)) formData.append("files", f);
    e.target.value = "";
    startTransition(async () => void toastResult(await uploadAttachments(entryType, entryId!, formData), "Anexo(s) enviado(s)."));
  }

  function onReplaceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = replacingId.current;
    e.target.value = "";
    if (!file || !id) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => void toastResult(await replaceAttachment(id, formData), "Anexo substituído."));
  }

  async function download(id: string) {
    setDownloadingId(id);
    const result = await getAttachmentUrl(id);
    setDownloadingId(null);
    if (toastResult(result) && result.ok) window.open(result.data!.url, "_blank");
  }

  if (!entryId) {
    return (
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Paperclip className="size-4" /> Anexos
          </Label>
          <Button type="button" variant="outline" size="sm" onClick={() => stagedInput.current?.click()}>
            <Upload /> Anexar arquivos
          </Button>
          <input
            ref={stagedInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              e.target.value = "";
              if (files && files.length > 0) setStaged((s) => [...s, ...Array.from(files)]);
            }}
          />
        </div>
        {staged.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo. Os arquivos escolhidos aqui são enviados ao salvar.</p>
        ) : (
          <ul className="grid gap-2">
            {staged.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{formatSize(f.size)} · enviado ao salvar</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover"
                  onClick={() => setStaged((s) => s.filter((_, j) => j !== i))}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Paperclip className="size-4" /> Anexos
        </Label>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => uploadInput.current?.click()}>
          {pending ? <Loader2 className="animate-spin" /> : <Upload />}
          Anexar arquivos
        </Button>
        <input ref={uploadInput} type="file" multiple className="hidden" onChange={onUploadChange} />
        <input ref={replaceInput} type="file" className="hidden" onChange={onReplaceChange} />
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
      ) : (
        <ul className="grid gap-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.fileName}</div>
                <div className="text-xs text-muted-foreground">{formatSize(a.sizeBytes)}</div>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={a.isPublic}
                  onCheckedChange={(v) =>
                    startTransition(
                      async () => void toastResult(await setAttachmentVisibility(a.id, v === true), "Visibilidade atualizada."),
                    )
                  }
                />
                Mostrar na empresa publicada
              </label>
              <Button type="button" variant="ghost" size="icon" aria-label="Baixar" disabled={downloadingId === a.id} onClick={() => download(a.id)}>
                {downloadingId === a.id ? <Loader2 className="animate-spin" /> : <Download />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Substituir"
                disabled={pending}
                onClick={() => {
                  replacingId.current = a.id;
                  replaceInput.current?.click();
                }}
              >
                <RefreshCw />
              </Button>
              <ConfirmAction
                title="Excluir anexo?"
                description={a.fileName}
                onConfirm={async () => toastResult(await deleteAttachment(a.id), "Anexo excluído.")}
              >
                <Button type="button" variant="ghost" size="icon" aria-label="Excluir">
                  <Trash2 className="text-destructive" />
                </Button>
              </ConfirmAction>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
