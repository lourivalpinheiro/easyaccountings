import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-semibold", className)}>
      <span className="relative flex size-8 shrink-0 items-center justify-center">
        <Image src="/brand/nedemy-symbol.png" alt="" width={32} height={32} className="dark:hidden" priority unoptimized />
        <Image src="/brand/nedemy-symbol-white.png" alt="" width={32} height={32} className="hidden dark:block" priority unoptimized />
      </span>
      <span className="font-heading text-lg leading-none tracking-wide">NEDEMY</span>
    </div>
  );
}
