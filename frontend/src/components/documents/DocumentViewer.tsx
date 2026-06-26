"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { DocumentAnnotation } from "@/lib/types";
import { applyHighlights, updateActiveHighlight } from "./highlight-annotations";
import { AnnotationSidebar } from "./AnnotationSidebar";
import { CommentForm } from "./CommentForm";
import { cn } from "@/lib/utils";

const BLOCK_SEP = "\n";

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
  const editorContainerRef = useRef<HTMLDivElement>(null);

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

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
        Link.configure({ openOnClick: false }),
      ],
      content: html ?? "<p></p>",
      editorProps: {
        attributes: {
          class: cn(
            "max-w-none px-6 py-4 outline-none",
            "text-[0.9375rem] leading-relaxed text-foreground",
            "[&_h1]:mt-0 [&_h1]:border-b [&_h1]:border-border/35 [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-semibold",
            "[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:first:mt-0",
            "[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:first:mt-0",
            "[&_p]:my-3 [&_p]:first:mt-0",
            "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
            "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6",
            "[&_.pdf-page]:mb-6 [&_.pdf-page]:pb-6 [&_.pdf-page]:border-b [&_.pdf-page]:border-dashed",
          ),
        },
      },
    },
    [html],
  );

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container || !editor || editor.isDestroyed) return;

    const proseMirror = container.querySelector(".ProseMirror") as HTMLElement | null;
    if (!proseMirror) return;

    const timer = setTimeout(() => {
      applyHighlights(proseMirror, annotations, activeAnnotationId);

      proseMirror.addEventListener("click", handleHighlightClick);
    }, 50);

    return () => {
      clearTimeout(timer);
      proseMirror.removeEventListener("click", handleHighlightClick);
    };
  }, [editor, annotations, activeAnnotationId]);

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

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    let domElement: HTMLElement | null = null;

    function handleMouseUp() {
      if (!editor || editor.isDestroyed) return;
      const { from, to } = editor.state.selection;
      if (from === to) {
        setSelection(null);
        return;
      }
      const selectedText = editor.state.doc.textBetween(from, to, BLOCK_SEP);
      if (!selectedText.trim()) {
        setSelection(null);
        return;
      }

      const nativeSelection = window.getSelection();
      const selectedString = nativeSelection?.toString() ?? selectedText;

      setSelection({
        text: selectedString,
        prefixContext: "",
        suffixContext: "",
      });
    }

    function attach() {
      try {
        domElement = editor!.view.dom;
        domElement.addEventListener("mouseup", handleMouseUp);
      } catch {
        domElement = null;
      }
    }

    attach();
    editor.on("create", attach);

    return () => {
      if (domElement) domElement.removeEventListener("mouseup", handleMouseUp);
      editor.off("create", attach);
    };
  }, [editor]);

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

    const container = editorContainerRef.current;
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
      <div className="min-w-0 flex-1 overflow-y-auto relative" ref={editorContainerRef}>
        <EditorContent editor={editor} />

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
