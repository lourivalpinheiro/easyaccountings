"use client";

import {
  BookOpen,
  Banknote,
  Building2,
  ChevronRight,
  FileText,
  FolderOpen,
  LayoutDashboard,
  type LucideIcon,
  PenLine,
  PiggyBank,
  Receipt,
  Settings2,
  ShieldCheck,
  Target,
  Wallet,
  Wrench,
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
    title: "Arquivo",
    icon: FolderOpen,
    items: [
      { title: "Notas explicativas", href: "/arquivo/notas-explicativas" },
      { title: "Plano de contas", href: "/arquivo/plano-de-contas" },
    ],
  },
  {
    title: "Movimento",
    icon: PenLine,
    items: [{ title: "Lançamentos", href: "/movimento/lancamentos" }],
  },
  {
    title: "Parâmetros",
    icon: Settings2,
    items: [
      { title: "Categorias de DRE", href: "/parametros/categorias-dre" },
      { title: "Históricos padrão", href: "/parametros/historicos" },
      { title: "Natureza das contas", href: "/parametros/natureza" },
    ],
  },
  {
    title: "Relatórios",
    icon: FileText,
    items: [
      { title: "Balancete de Verificação", href: "/relatorios/balancete" },
      { title: "Balanço Patrimonial", href: "/relatorios/balanco-patrimonial" },
      { title: "DRE", href: "/relatorios/dre" },
      { title: "Livro Diário", href: "/relatorios/livro-diario" },
      { title: "Livro Razão", href: "/relatorios/livro-razao" },
    ],
  },
  {
    title: "Utilitários",
    icon: Wrench,
    items: [
      { title: "Fechamento de período", href: "/utilitarios/fechamento" },
      { title: "Zeramento", href: "/parametros/zeramento" },
      { title: "Remoção de lançamentos", href: "/utilitarios/remocao" },
    ],
  },
];

const FINANCE: Section[] = [
  {
    title: "Fluxo de caixa",
    icon: Banknote,
    items: [
      { title: "Entradas e saídas", href: "/financeiro/fluxo-de-caixa" },
      { title: "Relatório", href: "/financeiro/relatorio" },
      { title: "Saúde de caixa", href: "/financeiro/saude" },
      { title: "Aplicações financeiras", href: "/financeiro/aplicacoes" },
      { title: "Relatório de aplicações", href: "/financeiro/aplicacoes/relatorio" },
    ],
  },
  {
    title: "Provisionamento",
    icon: Receipt,
    items: [
      { title: "Contas a pagar e a receber", href: "/financeiro/provisionamento" },
      { title: "Relatório", href: "/financeiro/provisionamento/relatorio" },
    ],
  },
  {
    title: "Planejamento",
    icon: Target,
    items: [{ title: "Planos financeiros", href: "/financeiro/planejamento" }],
  },
  {
    title: "Orçamento",
    icon: PiggyBank,
    items: [
      { title: "Orçamentos", href: "/financeiro/orcamentos" },
      { title: "Orçado x Realizado", href: "/financeiro/orcado-x-realizado" },
    ],
  },
  {
    title: "Utilitários",
    icon: Wrench,
    items: [
      { title: "Conciliação bancária", href: "/utilitarios/conciliacao" },
      { title: "Fechamento de período", href: "/utilitarios/fechamento" },
      { title: "Remoção de lançamentos", href: "/utilitarios/remocao" },
    ],
  },
];

const ADMIN: Section = {
  title: "Administração",
  icon: ShieldCheck,
  items: [
    { title: "Empresas", href: "/admin/empresas" },
    { title: "Usuários", href: "/admin/usuarios" },
  ],
};

function NavSection({ section, pathname }: { section: Section; pathname: string }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
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
                  <Link href={item.href} onClick={() => setOpenMobile(false)}>
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
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon" className="no-print">
      <SidebarHeader>
        <Link href="/" onClick={() => setOpenMobile(false)} className="px-1 py-1.5 group-data-[collapsible=icon]:px-0">
          <Logo className="[&>span:last-child]:group-data-[collapsible=icon]:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Início">
                <Link href="/" onClick={() => setOpenMobile(false)}>
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
        <SidebarGroup>
          <SidebarGroupLabel>
            <Wallet className="mr-2" /> Módulo Financeiro
          </SidebarGroupLabel>
          <SidebarMenu>
            {FINANCE.map((s) => (
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
