import { FileQuestion, Home } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Logo />
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="size-6 text-muted-foreground" />
          </span>
          <CardTitle className="text-xl">Página não encontrada</CardTitle>
          <CardDescription>O endereço acessado não existe ou foi movido.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/">
              <Home /> Voltar ao início
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
