"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentViewer } from "./DocumentViewer";

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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[1600px] p-0 sm:max-w-[1600px] sm:w-[calc(100vw-3rem)]">
        <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-border/60 bg-background px-6 py-4">
            <DialogTitle className="font-sans text-sm font-medium truncate text-muted-foreground">
              {documentName}
            </DialogTitle>
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
