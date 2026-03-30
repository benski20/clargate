"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { InboxItem } from "@/lib/types";

export default function AdminInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<InboxItem[]>("/messages/inbox")
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-2xl font-bold">Inbox</h1>
        <p className="mt-1 text-muted-foreground">
          All message threads across proposals.
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Inbox className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No messages yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.proposal_id} href={`/dashboard/admin/proposals/${item.proposal_id}`}>
              <Card className="cursor-pointer transition-colors duration-150 hover:bg-accent">
                <CardContent className="flex items-center gap-4 py-4">
                  <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">
                        {item.proposal_title}
                      </p>
                      {item.unread_count > 0 && (
                        <Badge variant="default" className="text-xs">
                          {item.unread_count}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground truncate">
                      {item.last_message.sender_name}: {item.last_message.body}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(item.last_message.created_at).toLocaleDateString()}
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
