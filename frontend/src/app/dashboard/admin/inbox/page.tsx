"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardCardClass, DashboardPageHeader } from "@/components/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";
import { db } from "@/lib/database";
import type { InboxItem, UserRole } from "@/lib/types";

function formatThreadDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminInboxPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await db.getCurrentAppUser();
      if (!cancelled) setRole(u?.role ?? null);
      try {
        const rows = await db.getInbox();
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const proposalHref = (id: string) => `/dashboard/admin/proposals/${id}?tab=messages`;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Administration"
        title="Inbox"
        description={
          role === "reviewer"
            ? "Message threads on proposals you are assigned to review."
            : "All message threads across proposals."
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : items.length === 0 ? (
        <Card className={dashboardCardClass}>
          <CardContent className="flex flex-col items-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
              <Inbox className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">No messages yet</p>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              {role === "reviewer"
                ? "When there is activity on your assigned proposals, threads will appear here."
                : "When PIs or reviewers message on proposals, threads will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className={cn(dashboardCardClass, "overflow-hidden p-0")}>
          <ul className="divide-y divide-border/50">
            {items.map((item) => {
              const preview =
                item.last_message_sender_name && item.last_message_body
                  ? `${item.last_message_sender_name}: ${item.last_message_body}`
                  : item.last_message_body ?? "No preview";

              return (
                <li key={item.proposal_id}>
                  <Link
                    href={proposalHref(item.proposal_id)}
                    className={cn(
                      "group flex gap-3 px-4 py-3.5 transition-colors sm:gap-4 sm:px-5",
                      "hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted/25 text-muted-foreground transition-colors group-hover:border-border/60 group-hover:bg-muted/40">
                      <MessageSquare className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span
                            className={cn(
                              "truncate text-sm text-foreground sm:text-[0.9375rem]",
                              item.unread_count > 0 ? "font-semibold" : "font-medium",
                            )}
                          >
                            {item.proposal_title}
                          </span>
                          {item.unread_count > 0 ? (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums text-primary">
                              {item.unread_count}
                            </span>
                          ) : null}
                        </div>
                        <time
                          dateTime={item.last_message_at ?? undefined}
                          className="shrink-0 text-xs tabular-nums text-muted-foreground"
                        >
                          {formatThreadDate(item.last_message_at)}
                        </time>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm leading-snug text-muted-foreground">
                        {preview}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
