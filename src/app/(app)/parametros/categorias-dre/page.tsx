import { asc, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { NoCompany, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { accounts, dreCategories } from "@/db/schema";
import { getPageContext } from "@/lib/page-context";
import { DreCategoriesClient } from "./dre-categories-client";

export const metadata: Metadata = { title: "Categorias de DRE" };

export default async function DreCategoriesPage() {
  const { user, company } = await getPageContext();
  if (!company) return <NoCompany isAdmin={user.role === "admin"} />;
  const categories = await db
    .select({ id: dreCategories.id, name: dreCategories.name, position: dreCategories.position, accounts: count(accounts.id) })
    .from(dreCategories)
    .leftJoin(accounts, eq(accounts.dreCategoryId, dreCategories.id))
    .where(eq(dreCategories.companyId, company.id))
    .groupBy(dreCategories.id)
    .orderBy(asc(dreCategories.position), asc(dreCategories.name));
  return (
    <>
      <PageHeader
        title="Categorias de DRE"
        description="Grupos em que as contas de resultado são apresentadas na Demonstração do Resultado, na ordem definida aqui."
      />
      <DreCategoriesClient categories={categories} />
    </>
  );
}
