import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sem conexão" };

/** Fallback servido pelo service worker quando a navegação falha por falta de internet. */
export default function OfflinePage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <Logo />
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <WifiOff className="size-6 text-muted-foreground" />
          </span>
          <CardTitle className="text-xl">Sem conexão com a internet</CardTitle>
          <CardDescription>Não foi possível carregar esta página. Verifique sua conexão e tente novamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/">Tentar novamente</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
