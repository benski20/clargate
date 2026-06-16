"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, FileUp, Loader2, MessageSquareText, ShieldAlert } from "lucide-react";
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
  const [access, setAccess] = useState<"loading" | "allowed" | "denied" | "no_certificate">("loading");

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
      if (u?.role !== "pi") {
        setAccess("denied");
        router.replace("/dashboard");
        return;
      }
      if (demoMode) {
        setAccess("allowed");
        return;
      }
      const certs = await db.getComplianceCertifications();
      if (cancelled) return;
      const today = new Date().toISOString().slice(0, 10);
      const hasValidCert = certs.some(
        (cert) => !cert.expires_at || cert.expires_at >= today,
      );
      setAccess(hasValidCert ? "allowed" : "no_certificate");
    })();
    return () => {
      cancelled = true;
    };
  }, [router, demoMode]);

  if (access === "loading" || access === "denied") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (access === "no_certificate") {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <ShieldAlert className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Training certificate required</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You need a valid, non-expired compliance certificate (e.g., CITI human subjects training) on file before you
          can create a proposal. Upload your certificate first, then return here to start drafting.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => router.push("/dashboard/proposals")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to proposals
          </Button>
          <Button onClick={() => router.push("/dashboard/certification")}>
            Upload certificate
          </Button>
        </div>
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
