"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AccountPicker, type PickerAccount } from "@/components/account-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastResult } from "@/lib/toast-result";
import { saveNote } from "../../actions";

type Note = { id?: string; number: number; title: string; content: string; accountId: string | null };

export function NoteEditor({ note, accounts }: { note: Note; accounts: PickerAccount[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(note);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await saveNote(draft);
      if (toastResult(result, "Nota salva.") && result.ok && !draft.id) {
        router.replace(`/arquivo/notas-explicativas/${result.data!.id}`);
      }
    });

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-[5rem_1fr] gap-4 md:grid-cols-[6rem_1fr_1fr]">
          <div className="grid gap-2">
            <Label htmlFor="number">Nota nº</Label>
            <Input
              id="number"
              type="number"
              min={1}
              value={draft.number}
              onChange={(e) => setDraft({ ...draft, number: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="col-span-2 grid gap-2 md:col-span-1">
            <Label>Conta contábil vinculada</Label>
            <AccountPicker
              accounts={accounts}
              value={draft.accountId}
              allowClear
              placeholder="Nenhuma (nota geral)"
              onChange={(accountId) => setDraft({ ...draft, accountId })}
            />
          </div>
        </div>
        <RichTextEditor value={note.content} onChange={(content) => setDraft((d) => ({ ...d, content }))} />
        <div className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/arquivo/notas-explicativas">
              <ArrowLeft /> Voltar
            </Link>
          </Button>
          <Button onClick={save} disabled={pending}>
            <Save /> Salvar nota
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
