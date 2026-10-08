"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { ConfirmAction } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toastResult } from "@/lib/toast-result";
import { createUser, deleteUser, updateUser } from "../actions";

type User = { id: string; name: string; email: string; role: "admin" | "user"; active: boolean };

export function UsersClient({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [role, setRole] = useState<"admin" | "user">("user");
  const [active, setActive] = useState(true);
  const [pending, startTransition] = useTransition();

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
        <div className="flex justify-end">
          <Button onClick={() => open({})}>
            <Plus /> Novo usuário
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role === "admin" ? "Administrador" : "Usuário"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.active ? "outline" : "destructive"}>{u.active ? "Ativo" : "Inativo"}</Badge>
                </TableCell>
                <TableCell className="text-right">
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
    </Card>
  );
}
