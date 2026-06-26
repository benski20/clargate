"use client";

import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface PdfRendererHandle {
  getContainer: () => HTMLDivElement | null;
}

export const PdfRenderer = forwardRef<
  PdfRendererHandle,
  { base64: string; onReady?: () => void }
>(function PdfRenderer({ base64, onReady }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const loadedPages = useRef(0);

  useImperativeHandle(ref, () => ({
    getContainer: () => containerRef.current,
  }));

  const fileData = useMemo(() => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return { data: bytes };
  }, [base64]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  function handleDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setPageCount(numPages);
    loadedPages.current = 0;
  }

  function handlePageRenderSuccess() {
    loadedPages.current += 1;
    if (loadedPages.current >= pageCount && pageCount > 0) {
      onReady?.();
    }
  }

  return (
    <div ref={containerRef} className="pdf-renderer">
      <Document file={fileData} onLoadSuccess={handleDocumentLoadSuccess}>
        {Array.from({ length: pageCount }, (_, index) => (
          <Page
            key={index}
            pageNumber={index + 1}
            width={containerWidth - 32}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            onRenderSuccess={handlePageRenderSuccess}
            className="pdf-page-canvas"
          />
        ))}
      </Document>
    </div>
  );
});
