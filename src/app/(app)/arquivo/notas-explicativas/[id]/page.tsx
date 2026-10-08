import { and, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { explanatoryNotes } from "@/db/schema";
import { getChart } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { NoteEditor } from "./note-editor";

export const metadata: Metadata = { title: "Nota explicativa" };

export default async function NoteEditorPage({ params }: PageProps<"/arquivo/notas-explicativas/[id]">) {
  const { id } = await params;
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;

  const isNew = id === "nova";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [chart, note, [{ next }]] = await Promise.all([
    getChart(company.id),
    isNew
      ? Promise.resolve(undefined)
      : db
          .select()
          .from(explanatoryNotes)
          .where(and(eq(explanatoryNotes.id, id), eq(explanatoryNotes.companyId, company.id)))
          .then((r) => r[0]),
    db
      .select({ next: sql<number>`coalesce(max(${explanatoryNotes.number}), 0) + 1` })
      .from(explanatoryNotes)
      .where(eq(explanatoryNotes.companyId, company.id)),
  ]);
  if (!isNew && !note) notFound();

  return (
    <>
      <PageHeader title={isNew ? "Nova nota explicativa" : `Nota ${note!.number} - ${note!.title}`} />
      <NoteEditor
        accounts={chart.map(({ id, reducedCode, classification, name }) => ({
          id,
          reducedCode,
          classification,
          name,
          analytic: true,
        }))}
        note={
          note
            ? { id: note.id, number: note.number, title: note.title, content: note.content, accountId: note.accountId }
            : { number: Number(next), title: "", content: "", accountId: null }
        }
      />
    </>
  );
}
