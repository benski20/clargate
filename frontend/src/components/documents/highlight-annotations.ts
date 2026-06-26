import type { DocumentAnnotation } from "@/lib/types";

const HIGHLIGHT_CLASS = "annotation-highlight";
const ACTIVE_CLASS = "annotation-highlight-active";
const RESOLVED_CLASS = "annotation-highlight-resolved";
const DATA_ATTR = "data-annotation-id";

export function applyHighlights(
  container: HTMLElement,
  annotations: DocumentAnnotation[],
  activeAnnotationId: string | null,
): void {
  clearHighlights(container);

  for (const annotation of annotations) {
    const range = findTextRange(container, annotation.quoted_text);
    if (!range) continue;
    wrapRange(range, annotation.id, annotation.is_resolved, annotation.id === activeAnnotationId);
  }
}

export function updateActiveHighlight(
  container: HTMLElement,
  activeAnnotationId: string | null,
): void {
  const marks = container.querySelectorAll(`mark[${DATA_ATTR}]`);
  for (const mark of marks) {
    const id = mark.getAttribute(DATA_ATTR);
    mark.classList.remove(ACTIVE_CLASS);
    if (id === activeAnnotationId) {
      mark.classList.add(ACTIVE_CLASS);
    }
  }
}

function clearHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll(`mark[${DATA_ATTR}]`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }
}

function findTextRange(container: HTMLElement, target: string): Range | null {
  if (!target || target.length === 0) return null;

  const normalized = target.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return null;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  const fullText = textNodes.map((textNode) => textNode.textContent ?? "").join("");
  const normalizedFull = fullText.replace(/\s+/g, " ");

  const matchIndex = normalizedFull.indexOf(normalized);
  if (matchIndex < 0) return null;

  const originalStart = normalizedToOriginalOffset(fullText, matchIndex);
  const originalEnd = normalizedToOriginalOffset(fullText, matchIndex + normalized.length);

  const startPoint = offsetToNodePoint(textNodes, originalStart);
  const endPoint = offsetToNodePoint(textNodes, originalEnd);

  if (!startPoint || !endPoint) return null;

  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range;
}

function normalizedToOriginalOffset(original: string, normalizedOffset: number): number {
  let normIdx = 0;
  let origIdx = 0;
  let inWhitespace = false;

  while (origIdx < original.length && normIdx < normalizedOffset) {
    const ch = original[origIdx];
    const isWs = /\s/.test(ch);

    if (isWs) {
      if (!inWhitespace) {
        normIdx++;
        inWhitespace = true;
      }
    } else {
      normIdx++;
      inWhitespace = false;
    }

    origIdx++;
  }

  return origIdx;
}

function offsetToNodePoint(
  textNodes: Text[],
  globalOffset: number,
): { node: Text; offset: number } | null {
  let accumulated = 0;

  for (const textNode of textNodes) {
    const len = textNode.textContent?.length ?? 0;
    if (accumulated + len >= globalOffset) {
      return { node: textNode, offset: globalOffset - accumulated };
    }
    accumulated += len;
  }

  if (textNodes.length > 0) {
    const lastNode = textNodes[textNodes.length - 1];
    return { node: lastNode, offset: lastNode.textContent?.length ?? 0 };
  }

  return null;
}

function wrapRange(range: Range, annotationId: string, isResolved: boolean, isActive: boolean): void {
  const mark = document.createElement("mark");
  mark.setAttribute(DATA_ATTR, annotationId);
  mark.classList.add(HIGHLIGHT_CLASS);
  if (isActive) mark.classList.add(ACTIVE_CLASS);
  if (isResolved) mark.classList.add(RESOLVED_CLASS);

  try {
    range.surroundContents(mark);
  } catch {
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
  }
}
