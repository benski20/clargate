"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileUp, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiIntakeWorkspace } from "@/components/proposals/AiIntakeWorkspace";
import { db } from "@/lib/database";

type EntryMode = "choose" | "upload" | "ai";

export default function NewProposalPage() {
  const router = useRouter();
  const [entryMode, setEntryMode] = useState<EntryMode>("choose");
  const [access, setAccess] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await db.getCurrentAppUser();
      if (cancelled) return;
      if (u?.role === "pi") {
        setAccess("allowed");
      } else {
        setAccess("denied");
        router.replace("/dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (access === "loading" || access === "denied") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (entryMode === "ai") {
    return <AiIntakeWorkspace variant="chat" onBack={() => setEntryMode("choose")} />;
  }

  if (entryMode === "upload") {
    return <AiIntakeWorkspace variant="upload" onBack={() => setEntryMode("choose")} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer shrink-0"
          onClick={() => router.push("/dashboard/proposals")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-semibold text-2xl tracking-tight md:text-3xl">
            New proposal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Upload your materials for AI review, or draft interactively with the AI workspace. Both paths
            use the same consent, compliance, and submit flow.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setEntryMode("upload")}
          className="group flex cursor-pointer flex-col rounded-xl border border-border/60 bg-card p-6 text-left shadow-sm transition-all hover:border-border hover:shadow-md"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
            <FileUp className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-semibold text-lg tracking-tight">
            Upload &amp; complete form
          </h2>
          <p className="mt-2 flex-1 text-sm text-muted-foreground leading-relaxed">
           
          </p>
          <span className="mt-4 inline-flex items-center text-sm font-medium text-primary group-hover:underline">
            Continue <ArrowRight className="ml-1 h-4 w-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setEntryMode("ai")}
          className="group flex cursor-pointer flex-col rounded-xl border border-border/60 bg-card p-6 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
            <MessageSquareText className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-semibold text-lg tracking-tight">Draft with AI</h2>
          <p className="mt-2 flex-1 text-sm text-muted-foreground leading-relaxed">
            Conversational intake, live IRB-style protocol, consent draft, compliance check, then submit —
            split-pane workspace.
          </p>
          <span className="mt-4 inline-flex items-center text-sm font-medium text-primary group-hover:underline">
            Open workspace <ArrowRight className="ml-1 h-4 w-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
