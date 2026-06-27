"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentAnnotation } from "@/lib/types";
import { applyHighlights } from "./highlight-annotations";
import { AnnotationSidebar } from "./AnnotationSidebar";
import { CommentForm } from "./CommentForm";
import { DocxRenderer } from "./DocxRenderer";
import type { DocxRendererHandle } from "./DocxRenderer";
import { PdfRenderer } from "./PdfRenderer";
import type { PdfRendererHandle } from "./PdfRenderer";

interface SelectionInfo {
  text: string;
  prefixContext: string;
  suffixContext: string;
}

interface RenderData {
  docxBase64: string | null;
  pdfBase64: string | null;
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
  const [rendererReady, setRendererReady] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const docxRef = useRef<DocxRendererHandle>(null);
  const pdfRef = useRef<PdfRendererHandle>(null);
  const viewerIdRef = useRef(`viewer-${documentId}`);

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
    const viewerId = viewerIdRef.current;

    let debounceTimer: ReturnType<typeof setTimeout>;

    function handleSelectionChange() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.anchorNode) {
          return;
        }

        const anchor = sel.anchorNode instanceof Element
          ? sel.anchorNode
          : sel.anchorNode.parentElement;
        if (!anchor) return;

        const inViewer = anchor.closest(`[data-viewer-id="${viewerId}"]`);
        if (!inViewer) return;

        const text = sel.toString();
        if (!text.trim()) return;

        setSelection({ text, prefixContext: "", suffixContext: "" });
      }, 300);
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const mark = target.closest("mark[data-annotation-id]");
      if (mark) {
        const annotationId = mark.getAttribute("data-annotation-id");
        if (annotationId) {
          setActiveAnnotationId(annotationId);
        }
      }
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("click", handleClick);
      clearTimeout(debounceTimer);
    };
  }, []);

  async function handleCreateAnnotation(body: string, quotedText?: string) {
    const quote = quotedText ?? selection?.text ?? "";
    if (!quote.trim() && !body.trim()) return;

    const response = await fetch(`/api/proposals/${proposalId}/documents/${documentId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoted_text: quote,
        prefix_context: "",
        suffix_context: "",
        body,
      }),
    });

    if (response.ok) {
      setSelection(null);
      setShowManualForm(false);
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
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading document…</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-destructive">{error}</div>;
  }

  const isDocx = !!renderData?.docxBase64;
  const isPdf = !!renderData?.pdfBase64;

  return (
    <div className="flex h-full min-h-0">
      <div
        className="min-w-0 flex-1 overflow-y-auto relative"
        data-viewer-id={viewerIdRef.current}
      >
        {isDocx && (
          <div className="docx-viewer-container px-4 py-4">
            <DocxRenderer
              ref={docxRef}
              base64={renderData!.docxBase64!}
              onReady={handleRendererReady}
            />
          </div>
        )}

        {isPdf && (
          <div className="pdf-viewer-container px-4 py-4">
            <PdfRenderer
              ref={pdfRef}
              base64={renderData!.pdfBase64!}
              onReady={handleRendererReady}
            />
          </div>
        )}

        {canAnnotate && selection && (
          <div className="sticky bottom-0 left-0 right-0 bg-background border-t p-4 z-10">
            <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
              Commenting on: &ldquo;{selection.text}&rdquo;
            </p>
            <CommentForm
              onSubmit={(body) => handleCreateAnnotation(body)}
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
          canAnnotate={canAnnotate}
          showManualForm={showManualForm}
          onAddComment={() => setShowManualForm(true)}
          onCancelManualForm={() => setShowManualForm(false)}
          onSubmitManualComment={handleCreateAnnotation}
          onAnnotationClick={handleAnnotationClick}
          onReply={handleReply}
          onResolve={handleResolve}
        />
      </div>
    </div>
  );
}
