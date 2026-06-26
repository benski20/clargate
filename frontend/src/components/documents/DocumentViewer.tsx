"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentAnnotation } from "@/lib/types";
import { applyHighlights } from "./highlight-annotations";
import { AnnotationSidebar } from "./AnnotationSidebar";
import { CommentForm } from "./CommentForm";
import { cn } from "@/lib/utils";

export function DocumentViewer({
  proposalId,
  documentId,
  currentUserId,
  canAnnotate,
}: {
  proposalId: string;
  documentId: string;
  currentUserId: string;
  canAnnotate: boolean;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchAnnotations = useCallback(async () => {
    const response = await fetch(`/api/proposals/${proposalId}/documents/${documentId}/annotations`);
    if (response.ok) {
      const data = await response.json();
      setAnnotations(data);
    }
  }, [proposalId, documentId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/proposals/${proposalId}/documents/${documentId}/render`);
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error ?? "Failed to render document");
          return;
        }
        const data = await response.json();
        setHtml(data.html);
        await fetchAnnotations();
      } catch {
        setError("Failed to load document");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [proposalId, documentId, fetchAnnotations]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container || !html) return;

    const timer = setTimeout(() => {
      applyHighlights(container, annotations, activeAnnotationId);
    }, 50);

    return () => clearTimeout(timer);
  }, [html, annotations, activeAnnotationId]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    function handleMouseUp() {
      const nativeSelection = window.getSelection();
      if (!nativeSelection || nativeSelection.isCollapsed) {
        setSelection(null);
        return;
      }

      if (!container!.contains(nativeSelection.anchorNode)) return;

      const selectedText = nativeSelection.toString();
      if (!selectedText.trim()) {
        setSelection(null);
        return;
      }

      setSelection({ text: selectedText, prefixContext: "", suffixContext: "" });
    }

    function handleHighlightClick(event: Event) {
      const target = event.target as HTMLElement;
      const mark = target.closest("mark[data-annotation-id]");
      if (mark) {
        const annotationId = mark.getAttribute("data-annotation-id");
        if (annotationId) {
          setActiveAnnotationId(annotationId);
        }
      }
    }

    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("click", handleHighlightClick);

    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("click", handleHighlightClick);
    };
  }, [html]);

  async function handleCreateAnnotation(body: string) {
    if (!selection) return;

    const response = await fetch(`/api/proposals/${proposalId}/documents/${documentId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoted_text: selection.text,
        prefix_context: selection.prefixContext,
        suffix_context: selection.suffixContext,
        body,
      }),
    });

    if (response.ok) {
      setSelection(null);
      await fetchAnnotations();
    }
  }

  async function handleReply(annotationId: string, body: string) {
    await fetch(
      `/api/proposals/${proposalId}/documents/${documentId}/annotations/${annotationId}/replies`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    await fetchAnnotations();
  }

  async function handleResolve(annotationId: string, resolved: boolean) {
    await fetch(
      `/api/proposals/${proposalId}/documents/${documentId}/annotations/${annotationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_resolved: resolved }),
      },
    );
    await fetchAnnotations();
  }

  function handleAnnotationClick(annotationId: string) {
    setActiveAnnotationId(annotationId);

    const container = contentRef.current;
    if (!container) return;

    const mark = container.querySelector(`mark[data-annotation-id="${annotationId}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading document…</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-destructive">{error}</div>;
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto relative">
        <div
          ref={contentRef}
          className={cn(
            "document-viewer-content max-w-none px-6 py-4",
            "text-[0.9375rem] leading-relaxed text-foreground",
          )}
          dangerouslySetInnerHTML={{ __html: html ?? "" }}
        />

        {canAnnotate && selection && (
          <div className="sticky bottom-0 left-0 right-0 bg-background border-t p-4">
            <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
              Commenting on: &ldquo;{selection.text}&rdquo;
            </p>
            <CommentForm
              onSubmit={handleCreateAnnotation}
              onCancel={() => setSelection(null)}
              placeholder="Add your comment…"
              submitLabel="Add comment"
            />
          </div>
        )}
      </div>

      <div className="w-80 shrink-0 border-l bg-background">
        <AnnotationSidebar
          annotations={annotations}
          activeAnnotationId={activeAnnotationId}
          currentUserId={currentUserId}
          canResolve={canAnnotate}
          onAnnotationClick={handleAnnotationClick}
          onReply={handleReply}
          onResolve={handleResolve}
        />
      </div>
    </div>
  );
}

interface SelectionInfo {
  text: string;
  prefixContext: string;
  suffixContext: string;
}
