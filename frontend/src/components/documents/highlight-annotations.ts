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
    highlightText(container, annotation.quoted_text, annotation.id, annotation.is_resolved, annotation.id === activeAnnotationId);
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
  const marks = Array.from(container.querySelectorAll(`mark[${DATA_ATTR}]`));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  }
  container.normalize();
}

function collectTextNodes(container: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

function highlightText(
  container: HTMLElement,
  target: string,
  annotationId: string,
  isResolved: boolean,
  isActive: boolean,
): void {
  if (!target || target.trim().length === 0) return;

  const normalizedTarget = target.replace(/\s+/g, " ").trim();
  if (normalizedTarget.length === 0) return;

  const textNodes = collectTextNodes(container);
  const match = findMatchInTextNodes(textNodes, normalizedTarget);
  if (!match) return;

  wrapTextNodeSpans(match, annotationId, isResolved, isActive);
}

interface TextNodeSpan {
  node: Text;
  startOffset: number;
  endOffset: number;
}

function findMatchInTextNodes(
  textNodes: Text[],
  normalizedTarget: string,
): TextNodeSpan[] | null {
  const chunks: { node: Text; text: string; globalStart: number }[] = [];
  let fullText = "";

  for (const node of textNodes) {
    const text = node.textContent ?? "";
    chunks.push({ node, text, globalStart: fullText.length });
    fullText += text;
  }

  const normalizedFull = fullText.replace(/\s+/g, " ");
  const matchIdx = normalizedFull.indexOf(normalizedTarget);
  if (matchIdx < 0) return null;

  const origStart = normalizedToOriginalOffset(fullText, matchIdx);
  const origEnd = normalizedToOriginalOffset(fullText, matchIdx + normalizedTarget.length);

  const spans: TextNodeSpan[] = [];

  for (const chunk of chunks) {
    const chunkEnd = chunk.globalStart + chunk.text.length;

    if (chunkEnd <= origStart) continue;
    if (chunk.globalStart >= origEnd) break;

    const startInChunk = Math.max(0, origStart - chunk.globalStart);
    const endInChunk = Math.min(chunk.text.length, origEnd - chunk.globalStart);

    if (startInChunk < endInChunk) {
      spans.push({ node: chunk.node, startOffset: startInChunk, endOffset: endInChunk });
    }
  }

  return spans.length > 0 ? spans : null;
}

function normalizedToOriginalOffset(original: string, normalizedOffset: number): number {
  let normIdx = 0;
  let origIdx = 0;
  let prevWasSpace = false;

  while (origIdx < original.length && normIdx < normalizedOffset) {
    const ch = original[origIdx];
    const isWs = /\s/.test(ch);

    if (isWs) {
      if (!prevWasSpace) {
        normIdx++;
        prevWasSpace = true;
      }
    } else {
      normIdx++;
      prevWasSpace = false;
    }

    origIdx++;
  }

  return origIdx;
}

function wrapTextNodeSpans(
  spans: TextNodeSpan[],
  annotationId: string,
  isResolved: boolean,
  isActive: boolean,
): void {
  for (const span of spans) {
    const textNode = span.node;
    const parent = textNode.parentNode;
    if (!parent) continue;

    const before = textNode.textContent?.slice(0, span.startOffset) ?? "";
    const highlighted = textNode.textContent?.slice(span.startOffset, span.endOffset) ?? "";
    const after = textNode.textContent?.slice(span.endOffset) ?? "";

    const mark = document.createElement("mark");
    mark.setAttribute(DATA_ATTR, annotationId);
    mark.classList.add(HIGHLIGHT_CLASS);
    if (isActive) mark.classList.add(ACTIVE_CLASS);
    if (isResolved) mark.classList.add(RESOLVED_CLASS);
    mark.textContent = highlighted;

    const fragment = document.createDocumentFragment();
    if (before) fragment.appendChild(document.createTextNode(before));
    fragment.appendChild(mark);
    if (after) fragment.appendChild(document.createTextNode(after));

    parent.replaceChild(fragment, textNode);
  }
}
