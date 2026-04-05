"use client";

import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "flex flex-col justify-between h-full w-full overflow-hidden rounded-2xl p-6 shadow-sm transition-shadow duration-300 hover:shadow-lg md:p-7",
  {
    variants: {
      gradient: {
        orange:
          "bg-gradient-to-br from-orange-50/85 to-amber-100/28 dark:from-orange-950/22 dark:to-amber-950/16",
        gray: "bg-gradient-to-br from-slate-50/90 to-slate-100/30 dark:from-slate-900/38 dark:to-slate-800/26",
        purple:
          "bg-gradient-to-br from-purple-50/80 to-indigo-100/24 dark:from-purple-950/20 dark:to-indigo-950/14",
        green:
          "bg-gradient-to-br from-emerald-50/80 to-teal-100/24 dark:from-emerald-950/20 dark:to-teal-950/14",
        sky:
          "bg-gradient-to-br from-sky-50/90 to-blue-100/30 dark:from-sky-950/25 dark:to-blue-950/18",
      },
    },
    defaultVariants: {
      gradient: "gray",
    },
  }
);

export interface GradientCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  badgeText: string;
  badgeColor: string;
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
}

const linkClass =
  "group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground";

const GradientCard = React.forwardRef<HTMLDivElement, GradientCardProps>(
  (
    {
      className,
      gradient,
      badgeText,
      badgeColor,
      title,
      description,
      ctaText,
      ctaHref,
      ...props
    },
    ref
  ) => {
    const cardAnimation = {
      rest: { scale: 1, y: 0 },
      hover: { scale: 1.02, y: -2 },
    };

    const useNativeAnchor =
      /^https?:\/\//i.test(ctaHref) ||
      ctaHref.startsWith("//") ||
      ctaHref.includes("#");

    const cta = (
      <>
        {ctaText}
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </>
    );

    return (
      <motion.div
        variants={cardAnimation}
        initial="rest"
        whileHover="hover"
        animate="rest"
        className="h-full"
        ref={ref}
      >
        <div className={cn(cardVariants({ gradient }), className)} {...props}>
          <div className="flex min-h-0 flex-col h-full">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-background/50 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur-sm w-fit md:text-sm">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: badgeColor }}
              />
              {badgeText}
            </div>

            <div className="flex-grow min-h-0">
              <h3 className="text-lg font-bold text-foreground mb-1.5 md:text-xl">
                {title}
              </h3>
              <p className="text-sm text-foreground/70 max-w-[18rem] leading-relaxed">
                {description}
              </p>
            </div>

            {useNativeAnchor ? (
              <a href={ctaHref} className={linkClass}>
                {cta}
              </a>
            ) : (
              <Link href={ctaHref} className={linkClass}>
                {cta}
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);
GradientCard.displayName = "GradientCard";

export { GradientCard, cardVariants };
