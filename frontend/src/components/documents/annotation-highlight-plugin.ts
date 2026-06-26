import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { DocumentAnnotation } from "@/lib/types";
import type { MutableRefObject } from "react";

export interface AnnotationRange {
  annotationId: string;
  from: number;
  to: number;
  isResolved: boolean;
}

export interface AnnotationHighlightState {
  ranges: AnnotationRange[];
  activeAnnotationId: string | null;
  onAnnotationClick: (annotationId: string) => void;
}

const annotationPluginKey = new PluginKey("annotationHighlight");

export const AnnotationHighlightExtension = Extension.create<{
  stateRef: MutableRefObject<AnnotationHighlightState>;
}>({
  name: "annotationHighlight",

  addOptions() {
    return {
      stateRef: { current: { ranges: [], activeAnnotationId: null, onAnnotationClick: () => {} } },
    };
  },

  addProseMirrorPlugins() {
    const stateRef = this.options.stateRef;

    return [
      new Plugin({
        key: annotationPluginKey,

        props: {
          decorations(state) {
            const { ranges, activeAnnotationId } = stateRef.current;
            const decorations: Decoration[] = [];

            for (const range of ranges) {
              if (range.from < 0 || range.to > state.doc.content.size) continue;

              const isActive = range.annotationId === activeAnnotationId;
              const className = isActive
                ? "annotation-highlight annotation-highlight-active"
                : range.isResolved
                  ? "annotation-highlight annotation-highlight-resolved"
                  : "annotation-highlight";

              decorations.push(
                Decoration.inline(range.from, range.to, {
                  class: className,
                  "data-annotation-id": range.annotationId,
                }),
              );
            }

            return DecorationSet.create(state.doc, decorations);
          },

          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;
            const highlight = target.closest("[data-annotation-id]");
            if (highlight) {
              const annotationId = highlight.getAttribute("data-annotation-id");
              if (annotationId) {
                stateRef.current.onAnnotationClick(annotationId);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

export function findAnnotationRanges(
  documentText: string,
  annotations: DocumentAnnotation[],
): AnnotationRange[] {
  const ranges: AnnotationRange[] = [];

  for (const annotation of annotations) {
    const searchTarget = annotation.prefix_context + annotation.quoted_text + annotation.suffix_context;
    const searchIndex = documentText.indexOf(searchTarget);

    if (searchIndex >= 0) {
      const from = searchIndex + annotation.prefix_context.length;
      const to = from + annotation.quoted_text.length;
      ranges.push({
        annotationId: annotation.id,
        from,
        to,
        isResolved: annotation.is_resolved,
      });
      continue;
    }

    const fallbackIndex = documentText.indexOf(annotation.quoted_text);
    if (fallbackIndex >= 0) {
      ranges.push({
        annotationId: annotation.id,
        from: fallbackIndex,
        to: fallbackIndex + annotation.quoted_text.length,
        isResolved: annotation.is_resolved,
      });
    }
  }

  return ranges;
}
