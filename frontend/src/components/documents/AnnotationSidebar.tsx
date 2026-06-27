"use client";

import { useState, useEffect, useRef } from "react";
import type { DocumentAnnotation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CommentForm } from "./CommentForm";
import { cn } from "@/lib/utils";

export function AnnotationSidebar({
  annotations,
  activeAnnotationId,
  currentUserId,
  canResolve,
  canAnnotate,
  detectedSelection,
  onClearDetectedSelection,
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
  detectedSelection: string;
  onClearDetectedSelection: () => void;
  onSubmitComment: (body: string, quotedText: string) => Promise<void>;
  onAnnotationClick: (annotationId: string) => void;
  onReply: (annotationId: string, body: string) => Promise<void>;
  onResolve: (annotationId: string, resolved: boolean) => Promise<void>;
}) {
  const [showResolved, setShowResolved] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentQuote, setCommentQuote] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const showCommentForm = !!commentQuote;

  useEffect(() => {
    if (detectedSelection && canAnnotate) {
      setCommentQuote(detectedSelection);
      onClearDetectedSelection();
      setTimeout(() => bodyRef.current?.focus(), 50);
    }
  }, [detectedSelection, canAnnotate, onClearDetectedSelection]);

  async function handleSubmit() {
    if (!commentBody.trim()) return;
    setSubmitting(true);
    try {
      await onSubmitComment(commentBody.trim(), commentQuote.trim());
      setCommentBody("");
      setCommentQuote("");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setCommentBody("");
    setCommentQuote("");
  }

  const visible = showResolved ? annotations : annotations.filter((annotation) => !annotation.is_resolved);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h3 className="text-sm font-semibold">Comments ({annotations.length})</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowResolved(!showResolved)}
          className="text-xs"
        >
          {showResolved ? "Hide resolved" : "Show resolved"}
        </Button>
      </div>

      {canAnnotate && showCommentForm && (
        <div className="flex-1 flex flex-col min-h-0 border-b">
          <div className="px-4 pt-4 pb-2 shrink-0">
            <p className="text-xs font-medium text-muted-foreground mb-2">New comment</p>
            <blockquote className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 border-l-2 border-primary/40 line-clamp-4">
              &ldquo;{commentQuote}&rdquo;
            </blockquote>
          </div>
          <div className="flex-1 px-4 py-2 min-h-0 flex flex-col">
            <textarea
              ref={bodyRef}
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Your comment…"
              className="flex-1 w-full resize-none rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px]"
            />
          </div>
          <div className="flex gap-2 justify-end px-4 pb-4 shrink-0">
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={handleSubmit}
              disabled={!commentBody.trim() || submitting}
            >
              Add comment
            </Button>
          </div>
        </div>
      )}

      {!showCommentForm && (
        <div className="flex-1 overflow-y-auto">
          {canAnnotate && (
            <p className="text-xs text-muted-foreground px-4 py-3 border-b">
              Select text in the document to add a comment
            </p>
          )}

          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-6 text-center">
              {annotations.length > 0 ? "All comments resolved" : "No comments yet"}
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
      )}
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
  const isAuthor = annotation.author_user_id === currentUserId;

  return (
    <div
      className={cn(
        "border-b px-4 py-3 cursor-pointer transition-colors",
        isActive ? "bg-accent/50" : "hover:bg-accent/25",
        annotation.is_resolved && "opacity-60",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-medium">{annotation.author_name ?? "Unknown"}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatTimestamp(annotation.created_at)}
        </span>
      </div>

      {annotation.quoted_text && (
        <blockquote className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 mb-2 line-clamp-2 border-l-2 border-muted-foreground/30">
          &ldquo;{annotation.quoted_text}&rdquo;
        </blockquote>
      )}

      <p className="text-sm mb-2">{annotation.body}</p>

      {annotation.replies.length > 0 && (
        <div className="ml-3 border-l-2 border-muted pl-3 space-y-2 mb-2">
          {annotation.replies.map((reply) => (
            <div key={reply.id}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium">{reply.author_name ?? "Unknown"}</span>
                <span className="text-xs text-muted-foreground">{formatTimestamp(reply.created_at)}</span>
              </div>
              <p className="text-sm">{reply.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-2" onClick={(event) => event.stopPropagation()}>
        {!isReplying && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onStartReply}>
            Reply
          </Button>
        )}
        {canResolve && (isAuthor || canResolve) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => onResolve(!annotation.is_resolved)}
          >
            {annotation.is_resolved ? "Reopen" : "Resolve"}
          </Button>
        )}
      </div>

      {isReplying && (
        <div className="mt-2" onClick={(event) => event.stopPropagation()}>
          <CommentForm
            onSubmit={onReply}
            onCancel={onCancelReply}
            placeholder="Write a reply…"
            submitLabel="Reply"
          />
        </div>
      )}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
