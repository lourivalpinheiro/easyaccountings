import { and, asc, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { historyCodes, journalEntries } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import { getAttachmentsByJournalEntry } from "@/lib/data/attachments";
import { getChart } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { readPeriod } from "@/lib/period";
import { EntriesClient } from "./entries-client";

export const metadata: Metadata = { title: "Lançamentos" };

export default async function EntriesPage({ searchParams }: PageProps<"/movimento/lancamentos">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const params = await searchParams;
  const period = readPeriod(params);
  const pageSize = [10, 25, 50, 100].includes(Number(params.por)) ? Number(params.por) : 25;
  const page = Math.max(1, Math.floor(Number(params.pagina)) || 1);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";

  const filters: SQL[] = [
    eq(journalEntries.companyId, company.id),
    gte(journalEntries.date, period.from),
    lte(journalEntries.date, period.to),
  ];
  if (q) {
    const search = or(
      ilike(journalEntries.description, `%${q.replace(/[\\%_]/g, "\\$&")}%`),
      /^\d+$/.test(q) ? eq(journalEntries.number, Number(q)) : undefined,
    );
    if (search) filters.push(search);
  }
  const where = and(...filters);

  const [chart, histories, entries, [{ total }]] = await Promise.all([
    getChart(company.id),
    db
      .select({ code: historyCodes.code, description: historyCodes.description })
      .from(historyCodes)
      .where(eq(historyCodes.companyId, company.id))
      .orderBy(asc(historyCodes.code)),
    db.query.journalEntries.findMany({
      where,
      orderBy: [desc(journalEntries.date), desc(journalEntries.number)],
      with: { lines: { orderBy: (l, { asc }) => asc(l.position) } },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db.select({ total: count() }).from(journalEntries).where(where),
  ]);
  const attachmentsByEntry = await getAttachmentsByJournalEntry(entries.map((e) => e.id));

  return (
    <>
      <PageHeader title="Lançamentos" description="Lançamentos contábeis em partidas dobradas." />
      <EntriesClient
        period={period}
        query={q}
        paging={{ page, pageSize, total }}
        accounts={chart.map(({ id, reducedCode, classification, name, analytic }) => ({
          id,
          reducedCode,
          classification,
          name,
          analytic,
        }))}
        histories={histories}
        entries={entries.map((e) => ({
          id: e.id,
          number: e.number,
          date: e.date,
          historyCode: e.historyCode,
          description: e.description,
          closing: Boolean(e.closingBatchId),
          lines: e.lines.map((l) => ({ accountId: l.accountId, side: l.side, cents: toCents(l.amount) })),
          attachments: attachmentsByEntry.get(e.id) ?? [],
        }))}
      />
    </>
  );
}
