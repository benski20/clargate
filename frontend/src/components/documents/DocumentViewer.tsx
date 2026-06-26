"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { DocumentAnnotation } from "@/lib/types";
import type { AnnotationRange, AnnotationHighlightState } from "./annotation-highlight-plugin";
import { AnnotationHighlightExtension } from "./annotation-highlight-plugin";
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

  const highlightStateRef = useRef<AnnotationHighlightState>({
    ranges: [],
    activeAnnotationId: null,
    onAnnotationClick: setActiveAnnotationId,
  });

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
        AnnotationHighlightExtension.configure({ stateRef: highlightStateRef }),
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
    if (!editor || editor.isDestroyed || annotations.length === 0) {
      highlightStateRef.current = { ...highlightStateRef.current, ranges: [] };
      return;
    }

    try {
      const ranges = findAnnotationRangesInDoc(editor.state.doc, annotations);
      highlightStateRef.current = { ...highlightStateRef.current, ranges };
      forceDecorationUpdate(editor);
    } catch {
      highlightStateRef.current = { ...highlightStateRef.current, ranges: [] };
    }
  }, [editor, annotations]);

  useEffect(() => {
    highlightStateRef.current = { ...highlightStateRef.current, activeAnnotationId };
    if (editor && !editor.isDestroyed) {
      forceDecorationUpdate(editor);
    }
  }, [activeAnnotationId, editor]);

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

      const docSize = editor.state.doc.content.size;
      const prefixFrom = Math.max(1, from - 50);
      const suffixTo = Math.min(docSize, to + 50);
      const textBefore = editor.state.doc.textBetween(prefixFrom, from, BLOCK_SEP);
      const textAfter = editor.state.doc.textBetween(to, suffixTo, BLOCK_SEP);

      setSelection({
        text: selectedText,
        prefixContext: textBefore.slice(-30),
        suffixContext: textAfter.slice(0, 30),
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

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading document…</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-destructive">{error}</div>;
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto relative">
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
          onAnnotationClick={setActiveAnnotationId}
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

function forceDecorationUpdate(editor: NonNullable<ReturnType<typeof useEditor>>) {
  try {
    const transaction = editor.state.tr.setMeta("annotationUpdate", true);
    editor.view.dispatch(transaction);
  } catch {
    // view not ready
  }
}

interface PosMapEntry {
  virtualOffset: number;
  pmPos: number;
}

function buildPositionMap(doc: PmNode): { virtualText: string; entries: PosMapEntry[] } {
  const entries: PosMapEntry[] = [];
  let virtualText = "";
  let isFirstBlock = true;

  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (!isFirstBlock) {
        entries.push({ virtualOffset: virtualText.length, pmPos: pos });
        virtualText += BLOCK_SEP;
      }
      isFirstBlock = false;

      node.forEach((child, childOffset) => {
        if (child.isText && child.text) {
          const childPmPos = pos + 1 + childOffset;
          for (let i = 0; i < child.text.length; i++) {
            entries.push({ virtualOffset: virtualText.length, pmPos: childPmPos + i });
            virtualText += child.text[i];
          }
        }
      });

      return false;
    }

    return true;
  });

  entries.push({ virtualOffset: virtualText.length, pmPos: doc.content.size });

  return { virtualText, entries };
}

function virtualOffsetToPmPos(entries: PosMapEntry[], offset: number): number | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].virtualOffset <= offset) {
      return entries[i].pmPos + (offset - entries[i].virtualOffset);
    }
  }
  return entries.length > 0 ? entries[0].pmPos : null;
}

function findAnnotationRangesInDoc(
  doc: PmNode,
  annotations: DocumentAnnotation[],
): AnnotationRange[] {
  const { virtualText, entries } = buildPositionMap(doc);
  const ranges: AnnotationRange[] = [];

  for (const annotation of annotations) {
    const target = annotation.quoted_text;
    const prefix = annotation.prefix_context;

    let matchOffset = -1;

    if (prefix) {
      const withPrefix = prefix + target;
      const prefixIdx = virtualText.indexOf(withPrefix);
      if (prefixIdx >= 0) {
        matchOffset = prefixIdx + prefix.length;
      }
    }

    if (matchOffset < 0) {
      matchOffset = virtualText.indexOf(target);
    }

    if (matchOffset < 0) continue;

    const fromPos = virtualOffsetToPmPos(entries, matchOffset);
    const toPos = virtualOffsetToPmPos(entries, matchOffset + target.length);

    if (fromPos === null || toPos === null) continue;
    if (fromPos >= toPos) continue;
    if (toPos > doc.content.size) continue;

    ranges.push({
      annotationId: annotation.id,
      from: fromPos,
      to: toPos,
      isResolved: annotation.is_resolved,
    });
  }

  return ranges;
}
