"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConfirmProps = {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<unknown> | void;
};

/** Confirmação controlada (útil quando o gatilho está dentro de um menu). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Excluir",
  onConfirm,
  children,
}: ConfirmProps & { open: boolean; onOpenChange: (open: boolean) => void; children?: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                await onConfirm();
                onOpenChange(false);
              });
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Envolve um gatilho com uma confirmação antes de executar uma ação destrutiva. */
export function ConfirmAction({ children, ...props }: ConfirmProps & { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ConfirmDialog open={open} onOpenChange={setOpen} {...props}>
      {children}
    </ConfirmDialog>
  );
}
