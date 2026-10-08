import { Paperclip } from "lucide-react";
import { formatDate } from "@/lib/accounting";
import type { PublicAttachmentRow } from "@/lib/data/attachments";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PublicAttachments({ token, attachments }: { token: string; attachments: PublicAttachmentRow[] }) {
  if (attachments.length === 0) return null;
  return (
    <section className="mt-8 break-inside-avoid">
      <h3 className="mb-2 flex items-center gap-1.5 font-semibold uppercase">
        <Paperclip className="size-4" /> Anexos
      </h3>
      <ul className="grid gap-1.5 text-sm">
        {attachments.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted-foreground">{formatDate(a.entryDate)}</span>
            <span className="text-muted-foreground">{a.entryLabel}</span>
            <a
              href={`/publico/${token}/anexos/${a.id}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {a.fileName}
            </a>
            <span className="text-xs text-muted-foreground">({formatSize(a.sizeBytes)})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
