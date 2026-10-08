"use client";

import {
  BookOpen,
  Building2,
  ChevronRight,
  FileText,
  FolderOpen,
  LayoutDashboard,
  type LucideIcon,
  PenLine,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Section = { title: string; icon: LucideIcon; items: { title: string; href: string }[] };

const ACCOUNTING: Section[] = [
  {
    title: "Parâmetros",
    icon: Settings2,
    items: [
      { title: "Natureza das contas", href: "/parametros/natureza" },
      { title: "Categorias de DRE", href: "/parametros/categorias-dre" },
      { title: "Zeramento", href: "/parametros/zeramento" },
      { title: "Históricos padrão", href: "/parametros/historicos" },
    ],
  },
  {
    title: "Arquivo",
    icon: FolderOpen,
    items: [
      { title: "Plano de contas", href: "/arquivo/plano-de-contas" },
      { title: "Notas explicativas", href: "/arquivo/notas-explicativas" },
      { title: "Orçamentos", href: "/arquivo/orcamentos" },
    ],
  },
  {
    title: "Movimento",
    icon: PenLine,
    items: [{ title: "Lançamentos", href: "/movimento/lancamentos" }],
  },
  {
    title: "Relatórios",
    icon: FileText,
    items: [
      { title: "Balanço Patrimonial", href: "/relatorios/balanco-patrimonial" },
      { title: "Balancete de Verificação", href: "/relatorios/balancete" },
      { title: "Livro Diário", href: "/relatorios/livro-diario" },
      { title: "Livro Razão", href: "/relatorios/livro-razao" },
      { title: "DRE", href: "/relatorios/dre" },
      { title: "Orçado x Realizado", href: "/relatorios/orcamento" },
    ],
  },
];

const ADMIN: Section = {
  title: "Administração",
  icon: ShieldCheck,
  items: [
    { title: "Usuários", href: "/admin/usuarios" },
    { title: "Empresas", href: "/admin/empresas" },
  ],
};

function NavSection({ section, pathname }: { section: Section; pathname: string }) {
  const { state, isMobile } = useSidebar();
  const active = section.items.some((i) => pathname.startsWith(i.href));

  // Recolhida, a sidebar mostra só ícones: as páginas da seção abrem num menu lateral.
  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton isActive={active} aria-label={section.title}>
              <section.icon />
              <span>{section.title}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-52">
            <DropdownMenuLabel>{section.title}</DropdownMenuLabel>
            {section.items.map((item) => (
              <DropdownMenuItem key={item.href} asChild className={cn(pathname.startsWith(item.href) && "bg-accent")}>
                <Link href={item.href}>{item.title}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={active} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={section.title}>
            <section.icon />
            <span>{section.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {section.items.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton asChild isActive={pathname.startsWith(item.href)}>
                  <Link href={item.href}>
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon" className="no-print">
      <SidebarHeader>
        <Link href="/" className="px-1 py-1.5 group-data-[collapsible=icon]:px-0">
          <Logo className="[&>span:last-child]:group-data-[collapsible=icon]:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Início">
                <Link href="/">
                  <LayoutDashboard />
                  <span>Início</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>
            <BookOpen className="mr-2" /> Módulo Contábil
          </SidebarGroupLabel>
          <SidebarMenu>
            {ACCOUNTING.map((s) => (
              <NavSection key={s.title} section={s} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Building2 className="mr-2" /> Sistema
            </SidebarGroupLabel>
            <SidebarMenu>
              <NavSection section={ADMIN} pathname={pathname} />
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
