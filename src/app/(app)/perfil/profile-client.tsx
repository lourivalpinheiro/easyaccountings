"use client";

import { Loader2, Save, Trash2, UserRound } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastResult } from "@/lib/toast-result";
import { removeAvatar, updateProfile, uploadAvatar } from "./actions";

export function ProfileClient({
  name: initialName,
  email,
  role,
  avatarUrl,
}: {
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [pendingName, startNameTransition] = useTransition();
  const [pendingAvatar, startAvatarTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const initials = initialName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  function pickFile() {
    fileInput.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.set("avatar", file);
    startAvatarTransition(async () => void toastResult(await uploadAvatar(formData), "Foto atualizada."));
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Foto de perfil</CardTitle>
          <CardDescription>PNG, JPEG, WEBP ou GIF, até 5 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar size="lg">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={initialName} />}
            <AvatarFallback className="bg-primary text-primary-foreground">{initials || <UserRound />}</AvatarFallback>
          </Avatar>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onFileChange} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={pendingAvatar} onClick={pickFile}>
              {pendingAvatar ? <Loader2 className="animate-spin" /> : null}
              Trocar foto
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                disabled={pendingAvatar}
                onClick={() => startAvatarTransition(async () => void toastResult(await removeAvatar(), "Foto removida."))}
              >
                <Trash2 /> Remover
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:max-w-sm">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-email">E-mail</Label>
            <Input id="profile-email" value={email} disabled />
          </div>
          <div className="grid gap-2">
            <Label>Perfil de acesso</Label>
            <Input value={role === "admin" ? "Administrador" : "Usuário"} disabled />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            disabled={pendingName || name.trim().length < 2}
            onClick={() => startNameTransition(async () => void toastResult(await updateProfile({ name }), "Nome atualizado."))}
          >
            {pendingName ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
