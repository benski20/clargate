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
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-base font-semibold truncate">{documentName}</DialogTitle>
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
      </DialogContent>
    </Dialog>
  );
}
