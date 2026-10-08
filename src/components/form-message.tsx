import { CircleAlert, CircleCheck } from "lucide-react";
import type { FormState } from "@/lib/auth/actions";

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;
  const isError = Boolean(state.error);
  return (
    <p
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive"
          : "flex items-start gap-2 rounded-md bg-primary/10 p-2 text-sm text-primary"
      }
    >
      {isError ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <CircleCheck className="mt-0.5 size-4 shrink-0" />}
      {state.error ?? state.success}
    </p>
  );
}
