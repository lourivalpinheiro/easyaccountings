import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { CompanySwitcher } from "@/components/company-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { requireUser } from "@/lib/auth/session";
import { getActiveCompany, listCompanies } from "@/lib/company";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [companies, active, cookieStore] = await Promise.all([
    listCompanies(),
    getActiveCompany(),
    cookies(),
  ]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar isAdmin={user.role === "admin"} />
      <SidebarInset>
        <header className="no-print sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <CompanySwitcher
            companies={companies.map(({ id, legalName, cnpj }) => ({ id, legalName, cnpj }))}
            activeId={active?.id}
          />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} role={user.role} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
