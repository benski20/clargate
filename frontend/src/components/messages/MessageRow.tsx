"use client";

import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MessageRow({
  msg,
  viewerUserId,
}: {
  msg: Message;
  viewerUserId: string | null;
}) {
  const fromMe = Boolean(viewerUserId && msg.sender_user_id === viewerUserId);

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        fromMe ? "border-transparent bg-muted/40" : "bg-muted/50",
        !fromMe && !msg.is_read && "border-l-4 border-l-primary bg-primary/[0.04]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-sm font-medium">{msg.sender_name || "Unknown"}</span>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {!fromMe && !msg.is_read ? (
            <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
              New
            </span>
          ) : null}
          {fromMe ? (
            <span
              className={cn(
                "text-[0.65rem] font-medium uppercase tracking-wide",
                msg.is_read ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400",
              )}
              title={
                msg.is_read
                  ? "Read by the other party"
                  : "Not yet read by the other party"
              }
            >
              {msg.is_read ? "Read" : "Unread"}
            </span>
          ) : null}
          <span className="text-xs tabular-nums text-muted-foreground">
            {new Date(msg.created_at).toLocaleString()}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{msg.body}</p>
    </div>
  );
}
