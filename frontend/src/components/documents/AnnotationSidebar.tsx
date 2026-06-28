"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, CornerDownLeft, MessageSquare, RotateCcw, Send } from "lucide-react";
import type { DocumentAnnotation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600",
  "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-teal-600",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AnnotationSidebar({
  annotations,
  activeAnnotationId,
  currentUserId,
  canResolve,
  canAnnotate,
  commentingText,
  onCancelCommenting,
  onSubmitComment,
  onAnnotationClick,
  onReply,
  onResolve,
}: {
  annotations: DocumentAnnotation[];
  activeAnnotationId: string | null;
  currentUserId: string;
  canResolve: boolean;
  canAnnotate: boolean;
  commentingText: string;
  onCancelCommenting: () => void;
  onSubmitComment: (body: string, quotedText: string) => Promise<void>;
  onAnnotationClick: (annotationId: string) => void;
  onReply: (annotationId: string, body: string) => Promise<void>;
  onResolve: (annotationId: string, resolved: boolean) => Promise<void>;
}) {
  const [showResolved, setShowResolved] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const visible = showResolved ? annotations : annotations.filter((annotation) => !annotation.is_resolved);
  const resolvedCount = annotations.filter((annotation) => annotation.is_resolved).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{annotations.length}</span>
        </div>
        {resolvedCount > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showResolved ? "Hide resolved" : `${resolvedCount} resolved`}
          </button>
        )}
      </div>

      {canAnnotate && commentingText && (
        <NewCommentForm
          quotedText={commentingText}
          onCancel={onCancelCommenting}
          onSubmit={onSubmitComment}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {!commentingText && canAnnotate && annotations.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageSquare className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">No comments yet</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Highlight text in the document to leave a comment
            </p>
          </div>
        )}

        {!commentingText && annotations.length > 0 && visible.length === 0 && (
          <p className="text-sm text-muted-foreground px-4 py-8 text-center">
            All comments resolved
          </p>
        )}

        {visible.map((annotation) => (
          <AnnotationCard
            key={annotation.id}
            annotation={annotation}
            isActive={annotation.id === activeAnnotationId}
            currentUserId={currentUserId}
            canResolve={canResolve}
            isReplying={replyingTo === annotation.id}
            onClick={() => onAnnotationClick(annotation.id)}
            onStartReply={() => setReplyingTo(annotation.id)}
            onCancelReply={() => setReplyingTo(null)}
            onReply={async (body) => {
              await onReply(annotation.id, body);
              setReplyingTo(null);
            }}
            onResolve={(resolved) => onResolve(annotation.id, resolved)}
          />
        ))}
      </div>
    </div>
  );
}

function NewCommentForm({
  quotedText,
  onCancel,
  onSubmit,
}: {
  quotedText: string;
  onCancel: () => void;
  onSubmit: (body: string, quotedText: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(body.trim(), quotedText.trim());
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }, [body, submitting, onSubmit, quotedText]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="border-b animate-in slide-in-from-top-2 fade-in duration-200">
      <div className="px-4 pt-3 pb-2">
        <blockquote className="text-xs text-muted-foreground bg-muted/60 rounded-md px-3 py-2 border-l-2 border-primary/30 line-clamp-3 italic">
          {quotedText}
        </blockquote>
      </div>
      <div className="px-4 pb-3">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add your comment…"
          rows={3}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring transition-shadow"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground/50">
            {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to submit
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-3 text-xs gap-1"
              onClick={handleSubmit}
              disabled={!body.trim() || submitting}
            >
              <Send className="size-3" />
              {submitting ? "Saving" : "Comment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnnotationCard({
  annotation,
  isActive,
  currentUserId,
  canResolve,
  isReplying,
  onClick,
  onStartReply,
  onCancelReply,
  onReply,
  onResolve,
}: {
  annotation: DocumentAnnotation;
  isActive: boolean;
  currentUserId: string;
  canResolve: boolean;
  isReplying: boolean;
  onClick: () => void;
  onStartReply: () => void;
  onCancelReply: () => void;
  onReply: (body: string) => Promise<void>;
  onResolve: (resolved: boolean) => Promise<void>;
}) {
  const authorName = annotation.author_name ?? "Unknown";

  return (
    <div
      className={cn(
        "border-b px-4 py-3 cursor-pointer transition-all duration-150",
        isActive
          ? "bg-primary/[0.04] border-l-2 border-l-primary"
          : "hover:bg-muted/40 border-l-2 border-l-transparent",
        annotation.is_resolved && "opacity-50",
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn(
          "size-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold text-white mt-0.5",
          getAvatarColor(authorName),
        )}>
          {getInitials(authorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span className="text-xs font-semibold truncate">{authorName}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatRelativeTime(annotation.created_at)}
            </span>
          </div>

          {annotation.quoted_text && (
            <blockquote className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1 mb-1.5 line-clamp-2 border-l-2 border-muted-foreground/20 italic">
              {annotation.quoted_text}
            </blockquote>
          )}

          <p className="text-[13px] leading-relaxed">{annotation.body}</p>
        </div>
      </div>

      {annotation.replies.length > 0 && (
        <div className="ml-9 mt-2 space-y-2">
          {annotation.replies.map((reply) => {
            const replyAuthor = reply.author_name ?? "Unknown";
            return (
              <div key={reply.id} className="flex items-start gap-2">
                <div className={cn(
                  "size-5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-semibold text-white mt-0.5",
                  getAvatarColor(replyAuthor),
                )}>
                  {getInitials(replyAuthor)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[11px] font-semibold">{replyAuthor}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(reply.created_at)}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed">{reply.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-1 mt-2 ml-9" onClick={(event) => event.stopPropagation()}>
        {!isReplying && (
          <button
            onClick={onStartReply}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5 px-1 -ml-1 rounded"
          >
            <CornerDownLeft className="size-3" />
            Reply
          </button>
        )}
        {canResolve && (
          <button
            onClick={() => onResolve(!annotation.is_resolved)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5 px-1 rounded"
          >
            {annotation.is_resolved ? (
              <><RotateCcw className="size-3" /> Reopen</>
            ) : (
              <><Check className="size-3" /> Resolve</>
            )}
          </button>
        )}
      </div>

      {isReplying && (
        <div className="mt-2 ml-9 animate-in slide-in-from-top-1 fade-in duration-150" onClick={(event) => event.stopPropagation()}>
          <InlineReplyForm
            onSubmit={onReply}
            onCancel={onCancelReply}
          />
        </div>
      )}
    </div>
  );
}

function InlineReplyForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(body.trim());
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }, [body, submitting, onSubmit]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Reply…"
        rows={2}
        className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring transition-shadow"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground/50">
          {typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={handleSubmit}
            disabled={!body.trim() || submitting}
          >
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
}
