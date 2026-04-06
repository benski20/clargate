"use client";

import { useLayoutEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageRow } from "@/components/messages/MessageRow";
import type { Message } from "@/lib/types";

function scrollToThreadEnd(anchor: HTMLElement | null) {
  if (!anchor) return;
  const viewport = anchor.closest(
    '[data-slot="scroll-area-viewport"]',
  ) as HTMLElement | null;
  if (viewport) {
    viewport.scrollTop = viewport.scrollHeight;
  } else {
    anchor.scrollIntoView({ block: "end", behavior: "auto" });
  }
}

export function MessagesThread({
  messages,
  viewerUserId,
  emptyLabel,
  scrollAreaClassName,
}: {
  messages: Message[];
  viewerUserId: string | null;
  emptyLabel: string;
  scrollAreaClassName?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (messages.length === 0) return;
    const scroll = () => scrollToThreadEnd(endRef.current);
    scroll();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(scroll);
    });
    const inner = contentRef.current;
    const ro =
      inner &&
      new ResizeObserver(() => {
        scroll();
      });
    if (inner && ro) ro.observe(inner);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
    };
  }, [messages]);

  return (
    <ScrollArea className={scrollAreaClassName}>
      {messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div ref={contentRef} className="space-y-4 pr-2">
          {messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} viewerUserId={viewerUserId} />
          ))}
          <div ref={endRef} className="h-px w-full shrink-0" aria-hidden />
        </div>
      )}
    </ScrollArea>
  );
}
