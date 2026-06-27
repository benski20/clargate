"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";

export function AnnotationCountBadge({
  proposalId,
  documentId,
}: {
  proposalId: string;
  documentId: string;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/proposals/${proposalId}/documents/${documentId}/annotations`);
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const unresolvedCount = (data as { is_resolved: boolean }[]).filter(
          (annotation) => !annotation.is_resolved,
        ).length;
        if (!cancelled) setCount(unresolvedCount);
      } catch {
        // silent
      }
    }

    load();
    return () => { cancelled = true; };
  }, [proposalId, documentId]);

  if (count === null || count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      <MessageSquare className="h-3 w-3" />
      {count}
    </span>
  );
}
