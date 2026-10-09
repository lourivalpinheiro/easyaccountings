import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { accounts, historyCodes, journalEntries, journalLines } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import { getAttachmentsByJournalEntry } from "@/lib/data/attachments";
import { getChart } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { readPeriod } from "@/lib/period";
import { readTableParams } from "@/lib/table-controls";
import { filtersToSql, sortToSql } from "@/lib/table-sql";
import { ENTRY_COLUMNS } from "./columns";
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
  const table = readTableParams(params, ENTRY_COLUMNS);
  // Contas de cada lado como texto "classificação - nome" e total a débito, calculados por lançamento.
  const sideAccounts = (side: "D" | "C") =>
    sql`(select string_agg(${accounts.classification} || ' - ' || ${accounts.name}, ' | ')
      from ${journalLines} join ${accounts} on ${accounts.id} = ${journalLines.accountId}
      where ${journalLines.entryId} = ${journalEntries.id} and ${journalLines.side} = ${side})`;
  const columnExprs = {
    number: journalEntries.number,
    date: journalEntries.date,
    description: journalEntries.description,
    debit: sideAccounts("D"),
    credit: sideAccounts("C"),
    amount: sql`(select coalesce(sum(${journalLines.amount}), 0) from ${journalLines}
      where ${journalLines.entryId} = ${journalEntries.id} and ${journalLines.side} = 'D')`,
  };
  filters.push(...filtersToSql(ENTRY_COLUMNS, table.filters, columnExprs));
  const where = and(...filters);

  // Primeiro a página de ids (ordenada e filtrada com subconsultas), depois os lançamentos com as partidas.
  const [chart, histories, pageIds, [{ total }]] = await Promise.all([
    getChart(company.id),
    db
      .select({ code: historyCodes.code, description: historyCodes.description })
      .from(historyCodes)
      .where(eq(historyCodes.companyId, company.id))
      .orderBy(asc(historyCodes.code)),
    db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(where)
      .orderBy(...sortToSql(table.sort, columnExprs, [desc(journalEntries.date), desc(journalEntries.number)]))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(journalEntries).where(where),
  ]);
  const ids = pageIds.map((r) => r.id);
  const loaded =
    ids.length === 0
      ? []
      : await db.query.journalEntries.findMany({
          where: inArray(journalEntries.id, ids),
          with: { lines: { orderBy: (l, { asc }) => asc(l.position) } },
        });
  const byId = new Map(loaded.map((e) => [e.id, e]));
  const entries = ids.flatMap((id) => byId.get(id) ?? []);
  const attachmentsByEntry = await getAttachmentsByJournalEntry(ids);

  return (
    <>
      <PageHeader title="Lançamentos" description="Lançamentos contábeis em partidas dobradas." />
      <EntriesClient
        period={period}
        query={q}
        table={table}
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
