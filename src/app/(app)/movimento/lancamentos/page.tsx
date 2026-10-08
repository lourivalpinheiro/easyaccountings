import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { historyCodes, journalEntries } from "@/db/schema";
import { toCents } from "@/lib/accounting";
import { getChart } from "@/lib/data/ledger";
import { getPageContext } from "@/lib/page-context";
import { readPeriod } from "@/lib/period";
import { EntriesClient } from "./entries-client";

export const metadata: Metadata = { title: "Lançamentos" };

export default async function EntriesPage({ searchParams }: PageProps<"/movimento/lancamentos">) {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const period = readPeriod(await searchParams);

  const [chart, histories, entries] = await Promise.all([
    getChart(company.id),
    db
      .select({ code: historyCodes.code, description: historyCodes.description })
      .from(historyCodes)
      .where(eq(historyCodes.companyId, company.id))
      .orderBy(asc(historyCodes.code)),
    db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.companyId, company.id),
        gte(journalEntries.date, period.from),
        lte(journalEntries.date, period.to),
      ),
      orderBy: [desc(journalEntries.date), desc(journalEntries.number)],
      with: { lines: { orderBy: (l, { asc }) => asc(l.position) } },
      limit: 1000,
    }),
  ]);

  return (
    <>
      <PageHeader title="Lançamentos" description="Lançamentos contábeis em partidas dobradas." />
      <EntriesClient
        period={period}
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
        }))}
      />
    </>
  );
}
