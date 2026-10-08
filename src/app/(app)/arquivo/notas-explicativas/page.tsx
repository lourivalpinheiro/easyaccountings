import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NoCompany, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { accounts, explanatoryNotes } from "@/db/schema";
import { getPageContext } from "@/lib/page-context";
import { NotesTable } from "./notes-table";

export const metadata: Metadata = { title: "Notas explicativas" };

export default async function NotesPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const notes = await db
    .select({
      id: explanatoryNotes.id,
      number: explanatoryNotes.number,
      title: explanatoryNotes.title,
      updatedAt: explanatoryNotes.updatedAt,
      accountClassification: accounts.classification,
      accountName: accounts.name,
    })
    .from(explanatoryNotes)
    .leftJoin(accounts, eq(accounts.id, explanatoryNotes.accountId))
    .where(eq(explanatoryNotes.companyId, company.id))
    .orderBy(asc(explanatoryNotes.number));
  return (
    <>
      <PageHeader
        title="Notas explicativas"
        description="Notas vinculadas a contas contábeis são exibidas no Balanço Patrimonial."
      >
        <Button asChild>
          <Link href="/arquivo/notas-explicativas/nova">
            <Plus /> Nova nota
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent>
          <NotesTable notes={notes.map((n) => ({ ...n, updatedAt: n.updatedAt.toISOString() }))} />
        </CardContent>
      </Card>
    </>
  );
}
