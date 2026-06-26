"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

export interface DocxRendererHandle {
  getContainer: () => HTMLDivElement | null;
}

export const DocxRenderer = forwardRef<
  DocxRendererHandle,
  { base64: string; onReady?: () => void }
>(function DocxRenderer({ base64, onReady }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getContainer: () => containerRef.current,
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    async function render() {
      const { renderAsync } = await import("docx-preview");
      if (cancelled) return;

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      await renderAsync(bytes, container!, undefined, {
        className: "docx-preview-wrapper",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: true,
        ignoreFonts: false,
        breakPages: false,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
      });

      if (!cancelled) {
        onReady?.();
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [base64, onReady]);

  return <div ref={containerRef} className="docx-renderer" />;
});
