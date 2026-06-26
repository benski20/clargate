"use client";

import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DocumentViewer = dynamic(
  () => import("./DocumentViewer").then((mod) => ({ default: mod.DocumentViewer })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-64 text-muted-foreground">Loading viewer…</div> },
);

export function DocumentViewerDialog({
  open,
  onOpenChange,
  proposalId,
  documentId,
  documentName,
  currentUserId,
  canAnnotate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  documentId: string;
  documentName: string;
  currentUserId: string;
  canAnnotate: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[1400px] p-0 sm:max-w-[1400px] sm:w-[calc(100vw-2rem)]">
        <div className="flex h-[min(calc(100dvh-2rem),800px)] flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-border/60 bg-background px-6 pb-4 pt-6 sm:px-7">
            <DialogTitle className="font-sans text-base font-semibold truncate">{documentName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {open && (
              <DocumentViewer
                proposalId={proposalId}
                documentId={documentId}
                currentUserId={currentUserId}
                canAnnotate={canAnnotate}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
