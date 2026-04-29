"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { marked } from "marked";
import TurndownService from "turndown";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

marked.setOptions({ gfm: true, breaks: true });

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

function mdToHtml(md: string): string {
  const trimmed = md.trim();
  if (!trimmed) return "<p></p>";
  const out = marked.parse(trimmed, { async: false });
  return typeof out === "string" ? out : "<p></p>";
}

/**
 * Notion-like document surface: edit in place with no chrome/borders.
 * Markdown is the source of truth for persistence and submission.
 */
export function ProposalCanvasEditor({
  markdown,
  onMarkdownChange,
  className,
  placeholder,
}: {
  markdown: string;
  onMarkdownChange: (next: string) => void;
  className?: string;
  placeholder?: string;
}) {
  /** Tracks markdown last produced by the editor; start empty so the first prop sync always hydrates. */
  const lastEmitted = useRef("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Write your proposal here…",
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "font-medium text-primary underline underline-offset-4 hover:text-primary/90",
        },
      }),
    ],
    content: "<p></p>",
    editorProps: {
      attributes: {
        class: cn(
          "max-w-none px-2 py-2 outline-none focus:outline-none md:px-6",
          "min-h-[min(70vh,48rem)] text-[0.9375rem] leading-relaxed text-foreground",
          "[&_h1]:mt-0 [&_h1]:scroll-mt-4 [&_h1]:border-b [&_h1]:border-border/35 [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
          "[&_h2]:mt-8 [&_h2]:scroll-mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:first:mt-0",
          "[&_h3]:mt-6 [&_h3]:scroll-mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:first:mt-0",
          "[&_h4]:mt-5 [&_h4]:text-base [&_h4]:font-semibold",
          "[&_p]:my-3 [&_p]:first:mt-0",
          "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6",
          "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6",
          "[&_li]:marker:text-muted-foreground",
          "[&_hr]:my-8 [&_hr]:border-border/60",
          "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/25 [&_blockquote]:pl-4 [&_blockquote]:text-[0.9375rem] [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
          "[&_code]:rounded-md [&_code]:border [&_code]:border-border/35 [&_code]:bg-muted/25 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125rem]",
          "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/25 [&_pre]:bg-muted/15 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[0.8125rem]",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const md = turndown.turndown(editor.getHTML()).trim();
      lastEmitted.current = md;
      onMarkdownChange(md);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (markdown === lastEmitted.current) return;
    lastEmitted.current = markdown;
    editor.commands.setContent(mdToHtml(markdown), { emitUpdate: false });
  }, [editor, markdown]);

  if (!editor) {
    return <div className={cn("min-h-[min(70vh,48rem)] rounded-none bg-transparent", className)} aria-hidden />;
  }

  return (
    <div className={cn("rounded-none border-0 bg-transparent shadow-none ring-0", className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
