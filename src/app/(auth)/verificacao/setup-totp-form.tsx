"use client";

import { Check, Copy, Loader2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmTotpSetup, logout, startTotpSetup } from "@/lib/auth/actions";

export function SetupTotpForm() {
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(confirmTotpSetup, undefined);
  const [code, setCode] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    startTotpSetup().then(setSetup);
  }, []);

  async function copySecret() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(setup.secret);
    }
  }

  if (!setup) {
    return <Skeleton className="mx-auto size-56" />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-center">
        <Image src={setup.qrDataUrl} alt="QR code para configurar o autenticador" width={220} height={220} className="rounded-lg border" unoptimized />
      </div>
      <div className="grid gap-1">
        <p className="text-center text-xs text-muted-foreground">Ou digite a chave manualmente no app:</p>
        <button
          type="button"
          onClick={copySecret}
          className="mx-auto flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 font-mono text-sm tracking-wider hover:bg-muted"
        >
          {setup.secret}
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4 text-muted-foreground" />}
        </button>
      </div>
      <form ref={formRef} action={action} className="grid gap-4">
        <p className="text-center text-sm text-muted-foreground">Depois de adicionar, digite o código de 6 dígitos para confirmar.</p>
        <div className="flex justify-center">
          <InputOTP maxLength={6} name="code" value={code} onChange={setCode} onComplete={() => formRef.current?.requestSubmit()} autoFocus>
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <FormMessage state={state} />
        <Button type="submit" disabled={pending || code.length < 6}>
          {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Confirmar e ativar
        </Button>
      </form>
      <div className="flex justify-end text-sm">
        <button type="button" className="text-muted-foreground hover:underline" onClick={() => logout()}>
          Usar outra conta
        </button>
      </div>
    </div>
  );
}
