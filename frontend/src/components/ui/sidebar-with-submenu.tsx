"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SidebarNavCollapsibleItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  /** Optional badge count (e.g. unread messages for Inbox). */
  badgeCount?: number | null;
};

/**
 * Collapsible section with a left border rail for nested links (shadcn-style sidebar pattern).
 */
export function SidebarNavCollapsible({
  title,
  icon: Icon,
  items,
  onNavigate,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SidebarNavCollapsibleItem[];
  onNavigate?: () => void;
}) {
  const submenuId = React.useId();
  const hasActiveChild = items.some((i) => i.isActive);
  const [open, setOpen] = React.useState(hasActiveChild);

  React.useEffect(() => {
    if (hasActiveChild) {
      setOpen(true);
    }
  }, [hasActiveChild]);

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
          hasActiveChild
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        aria-expanded={open}
        aria-controls={submenuId}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{title}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={submenuId}
          className="ml-1 space-y-0.5 border-l border-sidebar-border pl-3"
        >
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-label={
                  item.badgeCount && item.badgeCount > 0
                    ? `${item.label}, ${item.badgeCount} unread`
                    : item.label
                }
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
                  item.isActive
                    ? "bg-primary/5 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badgeCount != null && item.badgeCount > 0 ? (
                  <span
                    className="inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-primary-foreground shadow-sm"
                    aria-hidden
                  >
                    {item.badgeCount > 99 ? "99+" : item.badgeCount}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
