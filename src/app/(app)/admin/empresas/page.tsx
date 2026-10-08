import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { listCompanies } from "@/lib/company";
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
        companies={companies.map(({ id, personType, legalName, document, publicToken }) => ({
          id,
          personType,
          legalName,
          document,
          publicToken,
        }))}
      />
    </>
  );
}
