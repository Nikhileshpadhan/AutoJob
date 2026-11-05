import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-xs font-medium uppercase tracking-wider transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "border-2 border-white bg-transparent text-white hover:bg-white hover:text-[#141516] active:bg-white/90",
        mint:
          "border-2 border-[#CCF2DF] bg-transparent text-[#CCF2DF] hover:bg-[#CCF2DF] hover:text-[#141516]",
        outline:
          "border-2 border-[#303132] bg-transparent text-white hover:border-white hover:bg-white/5",
        secondary:
          "border-2 border-[#262728] bg-[#262728] text-white hover:border-[#303132]",
        destructive:
          "border-2 border-rose-500/80 bg-transparent text-rose-400 hover:bg-rose-500 hover:text-white",
        ghost:
          "text-[#B8B9B9] hover:text-white hover:bg-[#262728]/60 border border-transparent",
        link:
          "text-[#CCF2DF] underline-offset-4 hover:underline p-0 h-auto normal-case tracking-normal",
      },
      size: {
        default: "h-10 px-5 py-2 text-xs",
        sm: "h-8 px-3.5 text-[11px]",
        lg: "h-14 px-7 text-sm", // Aronya 56px height
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
