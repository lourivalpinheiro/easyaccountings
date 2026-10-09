import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { CompanySwitcher } from "@/components/company-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { requireUser } from "@/lib/auth/session";
import { getActiveCompany, listAccessibleCompanies } from "@/lib/company";
import { AVATARS_BUCKET, publicUrl } from "@/lib/storage";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [companies, active, cookieStore] = await Promise.all([
    listAccessibleCompanies(user),
    getActiveCompany(user),
    cookies(),
  ]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar isAdmin={user.role === "admin"} />
      <SidebarInset>
        <header className="no-print sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
          <div className="min-w-0 flex-1">
          <CompanySwitcher
            companies={companies.map(({ id, personType, legalName, document }) => ({ id, personType, legalName, document }))}
            activeId={active?.id}
            pinnedId={user.pinnedCompanyId}
          />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <UserMenu
              name={user.name}
              email={user.email}
              role={user.role}
              avatarUrl={user.avatarPath ? publicUrl(AVATARS_BUCKET, user.avatarPath) : null}
            />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
