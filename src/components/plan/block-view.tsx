"use client";

import type { BlockModel, Tone } from "@/lib/plan/blocks";
import { cn } from "@/lib/utils";

const toneClass: Record<NonNullable<Tone>, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
  muted: "text-muted-foreground",
};
const tone = (t: Tone) => (t ? toneClass[t] : undefined);

/** Bloco de dados do plano (cartões, tabela e observações) no editor. */
export function BlockView({ model }: { model: BlockModel }) {
  return (
    <div className="grid gap-3">
      <div className="text-sm font-semibold">{model.title}</div>
      {model.empty ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{model.empty}</p>
      ) : (
        <>
          {model.cards && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {model.cards.map((c) => (
                <div key={c.label} className="rounded-md border bg-muted/30 p-2.5">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className={cn("font-semibold tabular-nums", tone(c.tone))}>{c.value}</div>
                  {c.hint && <div className="text-xs text-muted-foreground">{c.hint}</div>}
                </div>
              ))}
            </div>
          )}
          {model.table && (
            <div className="overflow-x-auto">
              <table className={cn("w-full border-collapse", model.table.small ? "text-xs" : "text-sm")}>
                <thead>
                  <tr className="border-b-2 border-foreground/60">
                    {model.table.columns.map((c, i) => (
                      <th
                        key={i}
                        className={cn("px-2 py-1 font-semibold whitespace-nowrap", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.table.rows.map((row, i) => (
                    <tr key={i} className={cn("border-b border-border/60", row.shaded && "bg-muted/50", row.bold && "font-semibold")}>
                      {row.cells.map((cell, j) => {
                        const align = model.table!.columns[j]?.align;
                        return (
                          <td
                            key={j}
                            className={cn(
                              "px-2 py-1",
                              align === "right" ? "text-right tabular-nums whitespace-nowrap" : align === "center" ? "text-center" : "",
                              cell.bold && "font-semibold",
                              tone(cell.tone),
                            )}
                          >
                            {cell.text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {model.notes && (
            <ul className="grid gap-1 text-sm">
              {model.notes.map((n, i) => (
                <li key={i} className={cn(tone(n.tone))}>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
