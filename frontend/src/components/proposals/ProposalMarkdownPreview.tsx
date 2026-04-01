"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const mdComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "scroll-mt-4 border-b border-border/60 pb-2 text-2xl font-semibold tracking-tight text-foreground first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn("mt-8 scroll-mt-4 text-xl font-semibold tracking-tight text-foreground first:mt-0", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-6 scroll-mt-4 text-lg font-semibold text-foreground first:mt-0", className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cn("mt-5 text-base font-semibold text-foreground", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-3 text-[0.9375rem] leading-relaxed text-foreground first:mt-0", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-3 list-disc space-y-1.5 pl-6 text-[0.9375rem] leading-relaxed text-foreground", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-3 list-decimal space-y-1.5 pl-6 text-[0.9375rem] leading-relaxed text-foreground", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("marker:text-muted-foreground", className)} {...props} />,
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("my-4 border-l-4 border-muted-foreground/40 pl-4 text-[0.9375rem] italic text-muted-foreground", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => <hr className={cn("my-8 border-border", className)} {...props} />,
  a: ({ className, ...props }) => (
    <a
      className={cn("font-medium text-primary underline underline-offset-4 hover:text-primary/90", className)}
      {...props}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  em: ({ className, ...props }) => <em className={cn("italic", className)} {...props} />,
  code: ({ className, children, ...props }) => {
    const isFenced = /language-[\w-]+/.test(className ?? "");
    const text = String(children);
    const isIndentedOrFenced = isFenced || text.includes("\n");
    if (isIndentedOrFenced) {
      return (
        <code
          className={cn(
            "block w-full whitespace-pre-wrap font-mono text-[0.8125rem] leading-relaxed text-foreground",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn(
          "rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ className, children, ...props }) => (
    <pre
      className={cn(
        "my-4 overflow-x-auto rounded-md border border-border/60 bg-muted/30 p-4 font-mono text-[0.8125rem] leading-relaxed",
        className,
      )}
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ className, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-md border border-border/60">
      <table className={cn("w-full min-w-[16rem] border-collapse text-left text-[0.875rem]", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead className={cn("border-b border-border bg-muted/30", className)} {...props} />
  ),
  tbody: ({ className, ...props }) => <tbody className={cn("divide-y divide-border/60", className)} {...props} />,
  tr: ({ className, ...props }) => <tr className={cn("", className)} {...props} />,
  th: ({ className, ...props }) => (
    <th className={cn("px-3 py-2 font-semibold text-foreground", className)} {...props} />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("px-3 py-2 align-top text-foreground", className)} {...props} />
  ),
};

type ProposalMarkdownPreviewProps = {
  markdown: string;
  className?: string;
};

/**
 * Renders stored Markdown as readable document text. The `markdown` string is unchanged;
 * this is display-only.
 */
export function ProposalMarkdownPreview({ markdown, className }: ProposalMarkdownPreviewProps) {
  return (
    <article className={cn("max-w-none text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
