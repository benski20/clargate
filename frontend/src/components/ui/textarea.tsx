"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  `field-sizing-content min-h-16 w-full resize-y bg-background text-foreground shadow-xs shadow-black/5
   border border-input transition-[color,box-shadow]
   placeholder:text-muted-foreground/80
   focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30
   disabled:cursor-not-allowed disabled:opacity-50 [&[readonly]]:opacity-70
   aria-invalid:border-destructive aria-invalid:ring-destructive/10 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/20`,
  {
    variants: {
      variant: {
        sm: "rounded-md px-2.5 py-2.5 text-xs leading-normal",
        md: "rounded-md px-3 py-3 text-[0.8125rem] leading-normal",
        lg: "rounded-md px-4 py-4 text-sm leading-relaxed",
      },
    },
    defaultVariants: {
      variant: "md",
    },
  },
);

function Textarea({
  className,
  variant,
  ...props
}: React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>) {
  return <textarea data-slot="textarea" className={cn(textareaVariants({ variant }), className)} {...props} />;
}

export { Textarea, textareaVariants };
