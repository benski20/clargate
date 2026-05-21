"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, FileUp, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TourDemoShell } from "@/components/dashboard/tour-demo/tour-demo-shell";
import { AiIntakeWorkspace } from "@/components/proposals/AiIntakeWorkspace";
import { db } from "@/lib/database";
import { getTourDemoIntakeSeed, type TourDemoIntakeMode } from "@/lib/tour-demo";
import { cn } from "@/lib/utils";

type EntryMode = "choose" | "upload" | "ai";

function parseDemoStep(raw: string | null): number {
  if (raw === null || raw === "") return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function NewProposalPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo");
  const demoStep = parseDemoStep(searchParams.get("demoStep"));
  const pickHighlight = searchParams.get("pick");
  const demoPicker = demo === "picker";
  const [entryMode, setEntryMode] = useState<EntryMode>("choose");
  const [access, setAccess] = useState<"loading" | "allowed" | "denied">("loading");

  const demoMode = demo === "upload" || demo === "chat";

  const demoSeed = useMemo(() => {
    if (!demoMode || (demo !== "upload" && demo !== "chat")) return undefined;
    return getTourDemoIntakeSeed(demo as TourDemoIntakeMode, demoStep);
  }, [demo, demoMode, demoStep]);

  useEffect(() => {
    if (demo === "picker") setEntryMode("choose");
    else if (demo === "upload") setEntryMode("upload");
    else if (demo === "chat") setEntryMode("ai");
    else if (!demo) setEntryMode("choose");
  }, [demo]);

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
    return (
      <AiIntakeWorkspace
        key={`chat-${demoStep}`}
        variant="chat"
        demoMode={demoMode}
        demoSeed={demoSeed}
        onBack={() => {
          if (demoMode) return;
          setEntryMode("choose");
        }}
      />
    );
  }

  if (entryMode === "upload") {
    return (
      <AiIntakeWorkspace
        key={`upload-${demoStep}`}
        variant="upload"
        demoMode={demoMode}
        demoSeed={demoSeed}
        onBack={() => {
          if (demoMode) return;
          setEntryMode("choose");
        }}
      />
    );
  }

  const chooseScreen = (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer shrink-0"
          onClick={() => router.push("/dashboard/proposals")}
          disabled={demoPicker}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-semibold text-2xl tracking-tight md:text-3xl">New proposal</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Upload your materials for AI review, or draft interactively with the AI workspace. Both paths use the
            same consent, compliance, and submit flow.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setEntryMode("upload")}
          className={cn(
            "group flex cursor-pointer flex-col rounded-xl border border-border/60 bg-card p-6 text-left shadow-sm transition-all hover:border-border hover:shadow-md",
            pickHighlight === "upload" && "border-primary/40 ring-2 ring-primary/30",
          )}
        >
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
            <FileUp className="h-5 w-5 text-primary" />
          </span>
          <span className="font-semibold text-lg tracking-tight">Upload &amp; complete</span>
          <span className="mt-2 flex-1 text-sm text-muted-foreground leading-relaxed">
            Upload PDF, Word, or Markdown. The AI reviews your materials, drafts consent, runs compliance checks,
            and surfaces suggested revisions.
          </span>
          <span className="mt-4 inline-flex items-center text-sm font-medium text-primary group-hover:underline">
            Continue <ArrowRight className="ml-1 h-4 w-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setEntryMode("ai")}
          className={cn(
            "group flex cursor-pointer flex-col rounded-xl border border-border/60 bg-card p-6 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md",
            pickHighlight === "chat" && "border-primary/40 ring-2 ring-primary/30",
          )}
        >
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5">
            <MessageSquareText className="h-5 w-5 text-primary" />
          </span>
          <span className="font-semibold text-lg tracking-tight">Draft with AI</span>
          <span className="mt-2 flex-1 text-sm text-muted-foreground leading-relaxed">
            Conversational intake, AI drafting, live IRB-style protocol, consent draft, compliance check, then
            submit.
          </span>
          <span className="mt-4 inline-flex items-center text-sm font-medium text-primary group-hover:underline">
            Open workspace <ArrowRight className="ml-1 h-4 w-4" />
          </span>
        </button>
      </div>
    </div>
  );

  return demoPicker ? <TourDemoShell>{chooseScreen}</TourDemoShell> : chooseScreen;
}

export default function NewProposalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      }
    >
      <NewProposalPageInner />
    </Suspense>
  );
}
