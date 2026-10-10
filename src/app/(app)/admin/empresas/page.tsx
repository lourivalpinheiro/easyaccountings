import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { listCompanies } from "@/lib/company";
import { LOGOS_BUCKET, publicUrl } from "@/lib/storage";
import { CompaniesClient } from "./companies-client";

export const metadata: Metadata = { title: "Empresas" };

export default async function CompaniesPage() {
  await requireAdmin();
  const companies = await listCompanies();
  return (
    <>
      <PageHeader
        title="Empresas"
        description="Empresas podem ser pessoa física (CPF), jurídica (CNPJ) ou informais (sem documento). Cada uma possui plano de contas, parâmetros, lançamentos e relatórios próprios."
      />
      <CompaniesClient
        companies={companies.map(({ id, personType, legalName, displayName, document, publicToken, publicSections, logoPath }) => ({
          id,
          personType,
          legalName,
          displayName,
          document,
          publicToken,
          publicSections,
          logoUrl: logoPath ? publicUrl(LOGOS_BUCKET, logoPath) : null,
        }))}
      />
    </>
  );
}
