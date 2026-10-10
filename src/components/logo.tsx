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

/** Marca empilhada (símbolo sobre "NEDEMY"), para telas de destaque como o login. */
export function LogoVertical({ className }: { className?: string }) {
  return (
    <span className={cn("relative block", className)}>
      <Image src="/brand/nedemy-vertical.png" alt="Nedemy" width={746} height={370} className="h-auto w-full dark:hidden" priority unoptimized />
      <Image
        src="/brand/nedemy-vertical-white.png"
        alt="Nedemy"
        width={747}
        height={371}
        className="hidden h-auto w-full dark:block"
        priority
        unoptimized
      />
    </span>
  );
}
