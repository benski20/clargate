"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [detectedSelection, setDetectedSelection] = useState("");
  const [debugInfo, setDebugInfo] = useState("Waiting…");
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
    const interval = setInterval(() => {
      const sel = window.getSelection();
      const sc = scrollContainerRef.current;

      if (!sel || !sc) {
        setDebugInfo(`sel=${!!sel} sc=${!!sc}`);
        return;
      }

      if (sel.isCollapsed || !sel.anchorNode) {
        setDebugInfo(`collapsed=${sel.isCollapsed} anchor=${!!sel.anchorNode}`);
        return;
      }

      const text = sel.toString();
      const anchor = sel.anchorNode instanceof Element
        ? sel.anchorNode
        : sel.anchorNode.parentElement;
      const contained = anchor ? sc.contains(anchor) : false;

      setDebugInfo(`text="${text.substring(0, 30)}" contained=${contained}`);

      if (text.trim() && contained) {
        setDetectedSelection(text);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [loading]);

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
      setDetectedSelection("");
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
        ref={scrollContainerRef}
        className="min-w-0 flex-1 overflow-y-auto relative"
      >
        <div className="sticky top-0 z-30 bg-amber-100 text-amber-900 text-xs px-3 py-1 font-mono">
          DEBUG: {debugInfo}
        </div>

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
      </div>

      <div className="w-80 shrink-0 border-l bg-background">
        <AnnotationSidebar
          annotations={annotations}
          activeAnnotationId={activeAnnotationId}
          currentUserId={currentUserId}
          canResolve={canAnnotate}
          canAnnotate={canAnnotate}
          detectedSelection={detectedSelection}
          onClearDetectedSelection={() => setDetectedSelection("")}
          onSubmitComment={handleCreateAnnotation}
          onAnnotationClick={handleAnnotationClick}
          onReply={handleReply}
          onResolve={handleResolve}
        />
      </div>
    </div>
  );
}
