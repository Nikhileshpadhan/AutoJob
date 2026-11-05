import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-none px-2.5 py-1 text-[10px] font-mono font-medium uppercase tracking-wider transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border border-[#CCF2DF]/40 bg-[#CCF2DF]/10 text-[#CCF2DF]",
        mint: "border border-[#CCF2DF]/50 bg-[#CCF2DF]/15 text-[#CCF2DF]",
        secondary: "border border-[#303132] bg-[#262728] text-[#B8B9B9]",
        outline: "border border-white/40 bg-transparent text-white",
        destructive: "border border-rose-500/40 bg-rose-500/10 text-rose-400",
        blocked: "border border-rose-500/40 bg-rose-500/10 text-rose-400",
        applied: "border border-[#CCF2DF]/40 bg-[#CCF2DF]/10 text-[#CCF2DF]",
        pending: "border border-amber-500/40 bg-amber-500/10 text-amber-300",
        linkedin: "border border-sky-400/30 bg-sky-500/10 text-sky-300",
        internshala: "border border-[#CCF2DF]/40 bg-[#CCF2DF]/10 text-[#CCF2DF]",
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
