import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default: "border border-primary/20 bg-primary/10 text-primary",
        secondary: "border border-border bg-secondary text-muted-foreground",
        destructive: "border border-destructive/20 bg-destructive/10 text-destructive",
        outline: "border border-border text-foreground",
        linkedin: "border border-sky-500/20 bg-sky-500/10 text-sky-400",
        internshala: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        applied: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        pending: "border border-amber-500/20 bg-amber-500/10 text-amber-400",
        blocked: "border border-rose-500/20 bg-rose-500/10 text-rose-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
