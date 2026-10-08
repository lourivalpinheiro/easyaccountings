import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-semibold", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Calculator className="size-4" />
      </span>
      <span className="text-lg leading-none">Easy Accountings</span>
    </div>
  );
}
