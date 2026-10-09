"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { BarChart3, Blocks, Check, CloudOff, ImagePlus, Loader2, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChartDialog } from "@/components/plan/chart-dialog";
import { PlanBlock, PlanChart } from "@/components/plan/plan-nodes";
import { usePlan } from "@/components/plan/plan-context";
import { baseExtensions, Toolbar } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_CHART } from "@/lib/plan/calc";
import { BLOCK_KINDS, BLOCK_LABELS, type DocNode, type PlanSection } from "@/lib/plan/types";
import { toastResult } from "@/lib/toast-result";
import { saveSectionContent, uploadPlanFile } from "@/app/(app)/financeiro/planejamento/actions";

type SaveState = { kind: "idle" | "saving" | "saved" | "error"; at?: string };

const SAVE_DELAY_MS = 1200;

function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Salvando...
      </span>
    );
  if (state.kind === "error")
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <CloudOff className="size-3.5" /> Não salvo
      </span>
    );
  if (state.kind === "saved")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3.5" /> Salvo às {state.at}
      </span>
    );
  return null;
}

/** Texto de uma seção do plano, com gráficos, blocos de dados, imagens e arquivos; salva sozinho. */
export function PlanEditor({
  section,
  initial,
  flushRef,
}: {
  section: PlanSection;
  initial: DocNode | undefined;
  /** Recebe a função que grava as alterações pendentes (usada antes de trocar de seção). */
  flushRef?: React.RefObject<(() => Promise<void>) | null>;
}) {
  const { planId } = usePlan();
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [chartOpen, setChartOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDoc = useRef<unknown>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const doc = pendingDoc.current;
    if (!doc) return;
    pendingDoc.current = null;
    setSave({ kind: "saving" });
    const result = await saveSectionContent(planId, section, doc);
    if (result.ok) {
      setSave({ kind: "saved", at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
    } else {
      pendingDoc.current = pendingDoc.current ?? doc;
      setSave({ kind: "error" });
      toastResult(result);
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [...baseExtensions("Escreva aqui. Use a barra para inserir gráficos, blocos de dados, imagens e arquivos."), PlanChart, PlanBlock],
    content: initial ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: { attributes: { class: "tiptap-content min-h-[28rem] p-4 outline-none" } },
    onUpdate: ({ editor }) => {
      pendingDoc.current = editor.getJSON();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
  });

  useEffect(() => {
    if (flushRef) flushRef.current = flush;
  });

  // Ao sair da seção, grava o que estiver pendente; avisa antes de fechar a aba com alterações não salvas.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pendingDoc.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(file: File, asImage: boolean) {
    if (!editor) return;
    const fd = new FormData();
    fd.set("file", file);
    setUploading(true);
    const result = await uploadPlanFile(planId, fd);
    setUploading(false);
    if (!toastResult(result) || !result.ok || !result.data) return;
    const { url, fileName } = result.data;
    if (asImage) {
      editor.chain().focus().setImage({ src: url, alt: fileName, title: fileName }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "paragraph",
          content: [{ type: "text", text: `Anexo: ${fileName}`, marks: [{ type: "link", attrs: { href: url, target: "_blank" } }] }],
        })
        .run();
    }
  }

  if (!editor) return <div className="min-h-[28rem] rounded-md border" />;

  return (
    <div className="rounded-md border bg-card">
      <Toolbar editor={editor}>
        <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => setChartOpen(true)}>
          <BarChart3 /> Gráfico
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <Blocks /> Dados
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Inserir bloco de dados</DropdownMenuLabel>
            {BLOCK_KINDS.map((k) => (
              <DropdownMenuItem key={k} onSelect={() => editor.chain().focus().insertContent({ type: "planBlock", attrs: { kind: k } }).run()}>
                {BLOCK_LABELS[k]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => imageInput.current?.click()}>
          <ImagePlus /> Imagem
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <Paperclip /> Arquivo
        </Button>
        <span className="ml-auto pr-2">
          {uploading ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Enviando...
            </span>
          ) : (
            <SaveIndicator state={save} />
          )}
        </span>
      </Toolbar>
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f, true);
        }}
      />
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f, false);
        }}
      />
      <EditorContent editor={editor} />
      {chartOpen && (
        <ChartDialog
          open
          initial={{ ...DEFAULT_CHART, title: "Novo gráfico" }}
          onClose={() => setChartOpen(false)}
          onSave={(spec) => {
            editor.chain().focus().insertContent({ type: "planChart", attrs: { spec } }).run();
            setChartOpen(false);
          }}
        />
      )}
    </div>
  );
}
