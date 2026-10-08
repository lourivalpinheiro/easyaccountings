import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-utils";

/** Exibe o resultado de uma server action e retorna se deu certo. */
export function toastResult(result: ActionResult<unknown>, success?: string) {
  if (!result.ok) {
    toast.error(result.error);
    return false;
  }
  if (success) toast.success(success);
  return true;
}
