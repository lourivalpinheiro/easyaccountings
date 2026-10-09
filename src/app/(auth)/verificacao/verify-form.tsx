"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { logout, verifyCode } from "@/lib/auth/actions";

export function VerifyForm() {
  const [state, action, pending] = useActionState(verifyCode, undefined);
  const [code, setCode] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid gap-4">
      <form ref={formRef} action={action} className="grid gap-4">
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
          Verificar
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
