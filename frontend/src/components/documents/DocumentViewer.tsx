"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentAnnotation } from "@/lib/types";
import { applyHighlights } from "./highlight-annotations";
import { AnnotationSidebar } from "./AnnotationSidebar";
import { CommentForm } from "./CommentForm";
import { DocxRenderer } from "./DocxRenderer";
import type { DocxRendererHandle } from "./DocxRenderer";
import { cn } from "@/lib/utils";

interface SelectionInfo {
  text: string;
  prefixContext: string;
  suffixContext: string;
}

interface RenderData {
  html: string | null;
  docxBase64: string | null;
  fileType: string;
}

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
  const [renderData, setRenderData] = useState<RenderData | null>(null);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [docxReady, setDocxReady] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const docxRef = useRef<DocxRendererHandle>(null);

  const getHighlightContainer = useCallback((): HTMLElement | null => {
    if (renderData?.docxBase64) {
      return docxRef.current?.getContainer() ?? null;
    }
    return contentRef.current;
  }, [renderData?.docxBase64]);

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
      setDocxReady(false);
      try {
        const response = await fetch(`/api/proposals/${proposalId}/documents/${documentId}/render`);
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error ?? "Failed to render document");
          return;
        }
        const data = await response.json();
        setRenderData({
          html: data.html ?? null,
          docxBase64: data.docx_base64 ?? null,
          fileType: data.file_type,
        });
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
    const container = getHighlightContainer();
    if (!container) return;

    const isDocx = !!renderData?.docxBase64;
    if (isDocx && !docxReady) return;

    const timer = setTimeout(() => {
      applyHighlights(container, annotations, activeAnnotationId);
    }, 50);

    return () => clearTimeout(timer);
  }, [renderData, annotations, activeAnnotationId, docxReady, getHighlightContainer]);

  useEffect(() => {
    const container = getHighlightContainer();
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
  }, [renderData, docxReady, getHighlightContainer]);

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

    const container = getHighlightContainer();
    if (!container) return;

    const mark = container.querySelector(`mark[data-annotation-id="${annotationId}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  const handleDocxReady = useCallback(() => {
    setDocxReady(true);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading document…</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-destructive">{error}</div>;
  }

  const isDocx = !!renderData?.docxBase64;

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto relative">
        {isDocx ? (
          <div className="docx-viewer-container px-4 py-4">
            <DocxRenderer
              ref={docxRef}
              base64={renderData!.docxBase64!}
              onReady={handleDocxReady}
            />
          </div>
        ) : (
          <div
            ref={contentRef}
            className={cn(
              "document-viewer-content max-w-none px-6 py-4",
              "text-[0.9375rem] leading-relaxed text-foreground",
            )}
            dangerouslySetInnerHTML={{ __html: renderData?.html ?? "" }}
          />
        )}

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
