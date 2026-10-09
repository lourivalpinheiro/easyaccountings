"use client";

import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Columns3,
  Eraser,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Merge,
  Minus,
  Palette,
  Quote,
  Redo2,
  Rows3,
  SquareCode,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SupIcon,
  Table as TableIcon,
  Trash2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const FONTS = [
  { label: "Padrão", value: "default" },
  { label: "Changa", value: "var(--font-changa)" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];
const SIZES = ["default", "10px", "12px", "14px", "16px", "18px", "20px", "24px", "32px"];
const BLOCKS = [
  { label: "Parágrafo", value: "p" },
  { label: "Título 1", value: "1" },
  { label: "Título 2", value: "2" },
  { label: "Título 3", value: "3" },
];

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn("size-8", active && "bg-accent text-accent-foreground")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ColorButton({ label, icon, onPick }: { label: string; icon: React.ReactNode; onPick: (color: string) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="relative flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent" aria-label={label}>
          {icon}
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => onPick(e.target.value)}
          />
        </label>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Barra de formatação; `children` acrescenta botões (ex.: inserir gráfico no planejamento). */
export function Toolbar({ editor, children }: { editor: Editor; children?: React.ReactNode }) {
  const chain = () => editor.chain().focus();
  const block = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : editor.isActive("heading", { level: 3 })
        ? "3"
        : "p";
  const font = (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "default";
  const size = (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "default";
  const inTable = editor.isActive("table");

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Endereço do link", previous ?? "https://");
    if (url === null) return;
    if (url === "") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="no-print sticky top-14 z-[5] flex flex-wrap items-center gap-0.5 border-b bg-background/95 p-1 backdrop-blur">
      <ToolButton label="Desfazer" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Refazer" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}>
        <Redo2 />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <Select
        value={block}
        onValueChange={(v) =>
          v === "p" ? chain().setParagraph().run() : chain().toggleHeading({ level: Number(v) as 1 | 2 | 3 }).run()
        }
      >
        <SelectTrigger size="sm" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BLOCKS.map((b) => (
            <SelectItem key={b.value} value={b.value}>
              {b.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={FONTS.some((f) => f.value === font) ? font : "default"}
        onValueChange={(v) => (v === "default" ? chain().unsetFontFamily().run() : chain().setFontFamily(v).run())}
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONTS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={SIZES.includes(size) ? size : "default"}
        onValueChange={(v) => (v === "default" ? chain().unsetFontSize().run() : chain().setFontSize(v).run())}
      >
        <SelectTrigger size="sm" className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SIZES.map((s) => (
            <SelectItem key={s} value={s}>
              {s === "default" ? "Tamanho" : s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolButton label="Negrito" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="Itálico" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton label="Sublinhado" active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()}>
        <Underline />
      </ToolButton>
      <ToolButton label="Tachado" active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </ToolButton>
      <ToolButton label="Subscrito" active={editor.isActive("subscript")} onClick={() => chain().toggleSubscript().run()}>
        <SubIcon />
      </ToolButton>
      <ToolButton label="Sobrescrito" active={editor.isActive("superscript")} onClick={() => chain().toggleSuperscript().run()}>
        <SupIcon />
      </ToolButton>
      <ToolButton label="Código" active={editor.isActive("code")} onClick={() => chain().toggleCode().run()}>
        <Code />
      </ToolButton>
      <ColorButton label="Cor do texto" icon={<Palette className="size-4" />} onPick={(c) => chain().setColor(c).run()} />
      <ColorButton
        label="Realce"
        icon={<Highlighter className="size-4" />}
        onPick={(c) => chain().setHighlight({ color: c }).run()}
      />
      <ToolButton label="Limpar formatação" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <Eraser />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolButton label="Alinhar à esquerda" active={editor.isActive({ textAlign: "left" })} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft />
      </ToolButton>
      <ToolButton label="Centralizar" active={editor.isActive({ textAlign: "center" })} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter />
      </ToolButton>
      <ToolButton label="Alinhar à direita" active={editor.isActive({ textAlign: "right" })} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight />
      </ToolButton>
      <ToolButton label="Justificar" active={editor.isActive({ textAlign: "justify" })} onClick={() => chain().setTextAlign("justify").run()}>
        <AlignJustify />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolButton label="Lista com marcadores" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label="Lista numerada" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label="Citação" active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}>
        <Quote />
      </ToolButton>
      <ToolButton label="Bloco de código" active={editor.isActive("codeBlock")} onClick={() => chain().toggleCodeBlock().run()}>
        <SquareCode />
      </ToolButton>
      <ToolButton label="Linha horizontal" onClick={() => chain().setHorizontalRule().run()}>
        <Minus />
      </ToolButton>
      <ToolButton label="Link" active={editor.isActive("link")} onClick={setLink}>
        <Link2 />
      </ToolButton>
      {editor.isActive("link") && (
        <ToolButton label="Remover link" onClick={() => chain().unsetLink().run()}>
          <Unlink />
        </ToolButton>
      )}
      <ToolButton
        label="Imagem (URL)"
        onClick={() => {
          const src = window.prompt("Endereço da imagem");
          if (src) chain().setImage({ src }).run();
        }}
      >
        <ImageIcon />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolButton label="Inserir tabela" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon />
      </ToolButton>
      {inTable && (
        <>
          <ToolButton label="Adicionar coluna" onClick={() => chain().addColumnAfter().run()}>
            <Columns3 />
          </ToolButton>
          <ToolButton label="Adicionar linha" onClick={() => chain().addRowAfter().run()}>
            <Rows3 />
          </ToolButton>
          <ToolButton label="Excluir coluna" onClick={() => chain().deleteColumn().run()}>
            <Columns3 className="text-destructive" />
          </ToolButton>
          <ToolButton label="Excluir linha" onClick={() => chain().deleteRow().run()}>
            <Rows3 className="text-destructive" />
          </ToolButton>
          <ToolButton label="Mesclar/dividir células" onClick={() => chain().mergeOrSplit().run()}>
            <Merge />
          </ToolButton>
          <ToolButton label="Excluir tabela" onClick={() => chain().deleteTable().run()}>
            <Trash2 className="text-destructive" />
          </ToolButton>
        </>
      )}
      {children && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />
          {children}
        </>
      )}
    </div>
  );
}

/** Extensões de formatação comuns aos editores do sistema. */
export function baseExtensions(placeholder: string) {
  return [
    StarterKit.configure({ link: { openOnClick: false } }),
    TextStyleKit,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Subscript,
    Superscript,
    Image,
    TableKit.configure({ table: { resizable: true } }),
    Placeholder.configure({ placeholder }),
  ];
}

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: baseExtensions("Escreva o conteúdo da nota explicativa..."),
    content: value,
    editorProps: {
      attributes: { class: "tiptap-content min-h-[24rem] p-4 outline-none" },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return <div className="min-h-[24rem] rounded-md border" />;
  return (
    <div className="rounded-md border">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
