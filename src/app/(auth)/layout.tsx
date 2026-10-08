import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Logo />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
