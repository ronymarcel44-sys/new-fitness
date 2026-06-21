import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("badge", className)}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      {children}
    </span>
  );
}
