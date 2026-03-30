"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dashboardCardClass, DashboardPageHeader } from "@/components/dashboard/dashboard-ui";
import { db } from "@/lib/database";
import type { InboxItem } from "@/lib/types";

export default function AdminInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db
      .getInbox()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        eyebrow="Administration"
        title="Inbox"
        description="All message threads across proposals."
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : items.length === 0 ? (
        <Card className={dashboardCardClass}>
          <CardContent className="flex flex-col items-center py-14">
            <Inbox className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No messages yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.proposal_id} href={`/dashboard/admin/proposals/${item.proposal_id}`}>
              <Card
                className={`${dashboardCardClass} cursor-pointer transition-colors duration-200 hover:bg-muted/40`}
              >
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <MessageSquare className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">{item.proposal_title}</p>
                      {item.unread_count > 0 && (
                        <Badge
                          variant="secondary"
                          className="rounded-full border-0 bg-foreground text-xs text-background"
                        >
                          {item.unread_count}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {item.last_message_sender_name}: {item.last_message_body}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.last_message_at
                      ? new Date(item.last_message_at).toLocaleDateString()
                      : "—"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
