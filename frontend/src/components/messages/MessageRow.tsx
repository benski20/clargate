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
  const peerLabel = msg.sender_name?.trim() || "Unknown";

  return (
    <div
      className={cn(
        "flex w-full min-w-0",
        fromMe ? "justify-end pl-8" : "justify-start pr-8",
      )}
    >
      <div
        className={cn(
          "flex max-w-[min(100%,26rem)] min-w-0 flex-col gap-1",
          fromMe ? "items-end text-right" : "items-start text-left",
        )}
      >
        <div
          className={cn(
            "flex w-full max-w-full items-center gap-2 px-0.5",
            fromMe ? "justify-end" : "justify-start",
          )}
        >
          <span
            className={cn(
              "max-w-full truncate text-xs font-semibold",
              fromMe ? "text-primary" : "text-foreground",
            )}
          >
            {fromMe ? "You" : peerLabel}
          </span>
          {!fromMe && !msg.is_read ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary/15 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-primary">
              New
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
            fromMe
              ? "rounded-br-md bg-primary text-primary-foreground"
              : cn(
                  "rounded-bl-md border border-border/70 bg-card text-foreground",
                  !msg.is_read && "ring-2 ring-primary/20",
                ),
          )}
        >
          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        </div>

        <div
          className={cn(
            "flex w-full max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 px-0.5 text-[0.65rem] tabular-nums text-muted-foreground",
            fromMe ? "justify-end" : "justify-start",
          )}
        >
          <time dateTime={msg.created_at}>
            {new Date(msg.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
          {fromMe ? (
            <span
              className={cn(
                "font-medium",
                msg.is_read ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400",
              )}
              title={
                msg.is_read
                  ? "Read by the other party"
                  : "Not yet read by the other party"
              }
            >
              {msg.is_read ? "Read" : "Sent"}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
