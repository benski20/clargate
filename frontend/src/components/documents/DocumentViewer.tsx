"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import type { DocumentAnnotation } from "@/lib/types";
import { applyHighlights } from "./highlight-annotations";
import { AnnotationSidebar } from "./AnnotationSidebar";
import { DocxRenderer } from "./DocxRenderer";
import type { DocxRendererHandle } from "./DocxRenderer";
import { PdfRenderer } from "./PdfRenderer";
import type { PdfRendererHandle } from "./PdfRenderer";

interface RenderData {
  docxBase64: string | null;
  pdfBase64: string | null;
  fileType: string;
}

interface SelectionPopover {
  text: string;
  top: number;
  left: number;
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
  const [rendererReady, setRendererReady] = useState(false);
  const [selectionPopover, setSelectionPopover] = useState<SelectionPopover | null>(null);
  const [commentingText, setCommentingText] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const docxRef = useRef<DocxRendererHandle>(null);
  const pdfRef = useRef<PdfRendererHandle>(null);

  const getHighlightContainer = useCallback((): HTMLElement | null => {
    if (renderData?.docxBase64) {
      return docxRef.current?.getContainer() ?? null;
    }
    if (renderData?.pdfBase64) {
      return pdfRef.current?.getContainer() ?? null;
    }
    return null;
  }, [renderData?.docxBase64, renderData?.pdfBase64]);

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
      setRendererReady(false);
      try {
        const response = await fetch(`/api/proposals/${proposalId}/documents/${documentId}/render`);
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error ?? "Failed to render document");
          return;
        }
        const data = await response.json();
        setRenderData({
          docxBase64: data.docx_base64 ?? null,
          pdfBase64: data.pdf_base64 ?? null,
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
    if (!container || !rendererReady) return;

    const timer = setTimeout(() => {
      applyHighlights(container, annotations, activeAnnotationId);
    }, 50);

    return () => clearTimeout(timer);
  }, [renderData, annotations, activeAnnotationId, rendererReady, getHighlightContainer]);

  useEffect(() => {
    if (!canAnnotate) return;

    function handleMouseUp() {
      setTimeout(() => {
        const sel = window.getSelection();
        const sc = scrollContainerRef.current;

        if (!sel || !sc || sel.isCollapsed || !sel.anchorNode) {
          setSelectionPopover(null);
          return;
        }

        const text = sel.toString().trim();
        const anchor = sel.anchorNode instanceof Element
          ? sel.anchorNode
          : sel.anchorNode.parentElement;
        const contained = anchor ? sc.contains(anchor) : false;

        if (text && contained) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const containerRect = sc.getBoundingClientRect();

          setSelectionPopover({
            text,
            top: rect.bottom - containerRect.top + sc.scrollTop + 6,
            left: rect.left - containerRect.left + rect.width / 2,
          });
        } else {
          setSelectionPopover(null);
        }
      }, 10);
    }

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("[data-comment-popover]")) return;
      setSelectionPopover(null);
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [loading, canAnnotate]);

  function handleStartCommenting() {
    if (!selectionPopover) return;
    setCommentingText(selectionPopover.text);
    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  }

  async function handleCreateAnnotation(body: string, quotedText: string) {
    const response = await fetch(`/api/proposals/${proposalId}/documents/${documentId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoted_text: quotedText,
        prefix_context: "",
        suffix_context: "",
        body,
      }),
    });

    if (response.ok) {
      setCommentingText("");
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

  const handleRendererReady = useCallback(() => {
    setRendererReady(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="size-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          <span className="text-sm">Loading document</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>;
  }

  const isDocx = !!renderData?.docxBase64;
  const isPdf = !!renderData?.pdfBase64;

  return (
    <div className="flex h-full min-h-0">
      <div
        ref={scrollContainerRef}
        className="min-w-0 flex-1 overflow-y-auto relative bg-muted/30"
      >
        {isDocx && (
          <div className="docx-viewer-container px-6 py-6">
            <DocxRenderer
              ref={docxRef}
              base64={renderData!.docxBase64!}
              onReady={handleRendererReady}
            />
          </div>
        )}

        {isPdf && (
          <div className="pdf-viewer-container px-6 py-6">
            <PdfRenderer
              ref={pdfRef}
              base64={renderData!.pdfBase64!}
              onReady={handleRendererReady}
            />
          </div>
        )}

        {canAnnotate && selectionPopover && (
          <button
            data-comment-popover
            onClick={handleStartCommenting}
            className="absolute z-50 flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg transition-all hover:scale-105 active:scale-95 animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: selectionPopover.top,
              left: selectionPopover.left,
              transform: "translateX(-50%)",
            }}
          >
            <MessageSquarePlus className="size-3.5" />
            Comment
          </button>
        )}
      </div>

      <div className="w-[340px] shrink-0 border-l bg-background flex flex-col">
        <AnnotationSidebar
          annotations={annotations}
          activeAnnotationId={activeAnnotationId}
          currentUserId={currentUserId}
          canResolve={canAnnotate}
          canAnnotate={canAnnotate}
          commentingText={commentingText}
          onCancelCommenting={() => setCommentingText("")}
          onSubmitComment={handleCreateAnnotation}
          onAnnotationClick={handleAnnotationClick}
          onReply={handleReply}
          onResolve={handleResolve}
        />
      </div>
    </div>
  );
}
