"use client";

import { Building2, Pencil, Plus, Search, ShieldOff, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { ConfirmAction } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { TablePagination, usePagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toastResult } from "@/lib/toast-result";
import { createUser, deleteUser, deleteUsers, resetUserTotp, setUserCompanies, updateUser } from "../actions";

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  hasTotp: boolean;
  companyIds: string[];
};
type CompanyOption = { id: string; legalName: string };

export function UsersClient({
  users,
  companies,
  currentUserId,
}: {
  users: User[];
  companies: CompanyOption[];
  currentUserId: string;
}) {
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [role, setRole] = useState<"admin" | "user">("user");
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [access, setAccess] = useState<User | null>(null);
  const [accessIds, setAccessIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [accessPending, startAccessTransition] = useTransition();

  function openAccess(u: User) {
    setAccess(u);
    setAccessIds(new Set(u.companyIds));
  }

  function toggleAccessCompany(id: string, checked: boolean) {
    setAccessIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function saveAccess() {
    if (!access) return;
    startAccessTransition(async () => {
      if (toastResult(await setUserCompanies(access.id, [...accessIds]), "Acesso atualizado.")) setAccess(null);
    });
  }
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);
  const { rows: pageRows, pagination } = usePagination(filtered);
  const selectable = pageRows.filter((u) => u.id !== currentUserId);

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(selectable.map((u) => u.id)) : new Set());
  }

  function open(user: Partial<User>) {
    setEditing(user);
    setRole(user.role ?? "user");
    setActive(user.active ?? true);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name"));
    const password = String(fd.get("password") ?? "");
    startTransition(async () => {
      const result = editing?.id
        ? await updateUser({ id: editing.id, name, role, active, password: password || undefined })
        : await createUser({ name, email: String(fd.get("email")), password, role });
      if (toastResult(result, editing?.id ? "Usuário atualizado." : "Usuário criado.")) setEditing(null);
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar usuário..." className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button onClick={() => open({})}>
            <Plus /> Novo usuário
          </Button>
        </div>
        <BulkDeleteBar count={selected.size} onConfirm={() => deleteUsers([...selected])} onDone={() => setSelected(new Set())} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectable.length > 0 && selectable.every((u) => selected.has(u.id))}
                  onCheckedChange={(v) => toggleAll(v === true)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead className="hidden sm:table-cell">Perfil</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  {u.id !== currentUserId && (
                    <Checkbox checked={selected.has(u.id)} onCheckedChange={(v) => toggleRow(u.id, v === true)} aria-label={`Selecionar ${u.name}`} />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {u.name}
                  <div className="text-xs font-normal text-muted-foreground md:hidden">{u.email}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{u.email}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role === "admin" ? "Administrador" : "Usuário"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.active ? "outline" : "destructive"}>{u.active ? "Ativo" : "Inativo"}</Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {u.role === "user" && (
                    <Button variant="ghost" size="icon" aria-label="Empresas" title="Empresas que pode acessar" onClick={() => openAccess(u)}>
                      <Building2 />
                    </Button>
                  )}
                  {u.hasTotp && (
                    <ConfirmAction
                      title="Resetar autenticador?"
                      description={`${u.name} vai precisar configurar o aplicativo autenticador de novo no próximo login.`}
                      confirmLabel="Resetar"
                      onConfirm={async () => toastResult(await resetUserTotp(u.id), "Autenticador resetado.")}
                    >
                      <Button variant="ghost" size="icon" aria-label="Resetar autenticador" title="Resetar autenticador (TOTP)">
                        <ShieldOff />
                      </Button>
                    </ConfirmAction>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => open(u)}>
                    <Pencil />
                  </Button>
                  {u.id !== currentUserId && (
                    <ConfirmAction
                      title="Excluir usuário?"
                      description={`O usuário ${u.email} perderá o acesso permanentemente.`}
                      onConfirm={async () => toastResult(await deleteUser(u.id), "Usuário excluído.")}
                    >
                      <Button variant="ghost" size="icon" aria-label="Excluir">
                        <Trash2 className="text-destructive" />
                      </Button>
                    </ConfirmAction>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
<TablePagination {...pagination} />
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={editing?.name} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={editing?.email}
                disabled={Boolean(editing?.id)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">{editing?.id ? "Nova senha (opcional)" : "Senha inicial"}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required={!editing?.id}
              />
            </div>
            <div className="grid gap-2">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editing?.id && (
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
                Usuário ativo
              </Label>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={access !== null} onOpenChange={(o) => !o && setAccess(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empresas de {access?.name}</DialogTitle>
            <DialogDescription>Administradores sempre acessam todas; aqui você escolhe só para usuários comuns.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1">
            {companies.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>}
            {companies.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={accessIds.has(c.id)} onCheckedChange={(v) => toggleAccessCompany(c.id, v === true)} />
                {c.legalName}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAccess(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={accessPending} onClick={saveAccess}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
