import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
}

export function Card({ className, hover, glow, ...props }: CardProps) {
  return (
    <div
      className={cn("card", hover && "card-hover", glow && "border-accent/30 glow", className)}
      {...props}
    />
  );
}
