"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  FileDown,
  FileText,
  Library,
  Loader2,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Upload,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { db } from "@/lib/database";
import { supplementaryFromWorkspace } from "@/lib/ai-context";
import {
  emptyAiWorkspace,
  type AiWorkspaceState,
  type ProtocolSectionKey,
} from "@/lib/ai-proposal-types";
import { buildFormDataFromAiWorkspace } from "@/lib/ai-proposal-merge";
import {
  buildProposalPackageMarkdown,
  downloadProposalPackageMarkdown,
  proposalPackageFilename,
} from "@/lib/ai-proposal-package-markdown";

const MAX_ATTACHMENTS = 12;
const MAX_FILE_BYTES = 6 * 1024 * 1024;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function AiIntakeWorkspace({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [ws, setWs] = useState<AiWorkspaceState>(() => emptyAiWorkspace());
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rightTab, setRightTab] = useState<"context" | "consent" | "compliance" | "package">("context");
  const [consentBusy, setConsentBusy] = useState(false);
  const [complianceBusy, setComplianceBusy] = useState(false);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [packageS3Error, setPackageS3Error] = useState<string | null>(null);
  const [packageUploading, setPackageUploading] = useState(false);
  const bootRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const packageMarkdown = useMemo(
    () => buildProposalPackageMarkdown(ws, suggestedTitle),
    [ws, suggestedTitle],
  );

  const packageFingerprint = useMemo(
    () => `${packageMarkdown.length}:${packageMarkdown.slice(0, 2000)}`,
    [packageMarkdown],
  );

  const [proposalReviewAcknowledged, setProposalReviewAcknowledged] = useState(false);

  useEffect(() => {
    setProposalReviewAcknowledged(false);
  }, [packageFingerprint]);

  const complianceComplete =
    ws.phase === "compliance" && Boolean(ws.predicted_category);

  const canSubmitProposal =
    Boolean(proposalId) && complianceComplete && proposalReviewAcknowledged;

  const persist = useCallback(
    async (next: AiWorkspaceState, title: string) => {
      setSaving(true);
      try {
        const merged = buildFormDataFromAiWorkspace(next, title);
        const t = title.trim() || "Draft study";
        if (!proposalId) {
          const created = await db.createProposal(t, merged);
          setProposalId(created.id as string);
        } else {
          await db.updateProposal(proposalId, { title: t, form_data: merged });
        }
      } catch {
        /* non-blocking */
      } finally {
        setSaving(false);
      }
    },
    [proposalId],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      void persist(ws, suggestedTitle);
    }, 900);
    return () => clearTimeout(t);
  }, [ws, suggestedTitle, persist]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [ws.messages, aiBusy]);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      setAiBusy(true);
      try {
        const snap = emptyAiWorkspace();
        const res = await fetch("/api/prototype/ai-intake/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [],
            protocol: snap.protocol,
            supplementary_context: supplementaryFromWorkspace(snap),
            user_message:
              "I'm ready to start a new human subjects protocol. Please begin the conversational intake.",
          }),
        });
        const data = (await res.json()) as {
          assistant_message?: string;
          protocol?: AiWorkspaceState["protocol"];
          suggested_title?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Chat failed");
        setWs((w) => ({
          ...w,
          messages: [{ role: "assistant", content: data.assistant_message || "" }],
          protocol: data.protocol ?? w.protocol,
        }));
        if (data.suggested_title) setSuggestedTitle(data.suggested_title);
      } catch {
        setWs((w) => ({
          ...w,
          messages: [
            {
              role: "assistant",
              content:
                "I couldn't reach the AI service. Add GEMINI_API_KEY to your server env and try again.",
            },
          ],
        }));
      } finally {
        setAiBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
  }, []);

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || aiBusy) return;
    setChatInput("");
    const history = [...ws.messages, { role: "user" as const, content: text }];
    setWs((w) => ({ ...w, messages: history }));
    setAiBusy(true);
    try {
      const sup = supplementaryFromWorkspace(ws);
      const res = await fetch("/api/prototype/ai-intake/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: ws.messages,
          protocol: ws.protocol,
          supplementary_context: sup,
          user_message: text,
        }),
      });
      const data = (await res.json()) as {
        assistant_message?: string;
        protocol?: AiWorkspaceState["protocol"];
        suggested_title?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setWs((w) => ({
        ...w,
        messages: [...w.messages, { role: "assistant", content: data.assistant_message || "" }],
        protocol: data.protocol ?? w.protocol,
      }));
      if (data.suggested_title) setSuggestedTitle(data.suggested_title);
    } catch {
      setWs((w) => ({
        ...w,
        messages: [...w.messages, { role: "assistant", content: "Something went wrong. Please try again." }],
      }));
    } finally {
      setAiBusy(false);
    }
  }

  async function ingestFiles(fileList: FileList | null) {
    if (!fileList?.length || ingestBusy) return;
    setIngestError(null);
    setIngestBusy(true);
    const additions: AiWorkspaceState["context_attachments"] = [];
    try {
      let remaining = MAX_ATTACHMENTS - ws.context_attachments.length;
      if (remaining <= 0) {
        setIngestError(`Maximum ${MAX_ATTACHMENTS} files.`);
        return;
      }

      for (const file of Array.from(fileList)) {
        if (remaining <= 0) {
          setIngestError(`Maximum ${MAX_ATTACHMENTS} files.`);
          break;
        }
        if (file.size > MAX_FILE_BYTES) {
          setIngestError(`"${file.name}" is too large (max 6 MB).`);
          continue;
        }

        const name = file.name;
        const mime = file.type;
        const isText =
          mime.startsWith("text/") || /\.(txt|md|csv|json|xml|html?)$/i.test(name);

        let text = "";
        let err: string | null = null;

        if (isText) {
          try {
            text = (await file.text()).trim();
          } catch {
            err = `Could not read "${name}".`;
          }
        } else if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
          const base64 = await blobToBase64(file);
          const res = await fetch("/api/prototype/ai-intake/ingest-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, mimeType: mime || "application/pdf", base64 }),
          });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) {
            err = data.error || `Could not extract PDF: ${name}`;
          } else {
            text = (data.text || "").trim();
          }
        } else {
          err = `"${name}" is not a supported type (PDF or plain text).`;
        }

        if (err) {
          setIngestError(err);
          continue;
        }
        if (!text) {
          setIngestError(`No text extracted from "${name}".`);
          continue;
        }

        additions.push({
          id: crypto.randomUUID(),
          name,
          mimeType: mime || "application/octet-stream",
          text,
        });
        remaining -= 1;
      }

      if (additions.length > 0) {
        setWs((w) => ({
          ...w,
          context_attachments: [...w.context_attachments, ...additions],
        }));
      }
    } finally {
      setIngestBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setWs((w) => ({
      ...w,
      context_attachments: w.context_attachments.filter((a) => a.id !== id),
    }));
  }

  async function runConsent() {
    setConsentBusy(true);
    setRightTab("consent");
    try {
      const res = await fetch("/api/prototype/ai-intake/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: ws.protocol,
          supplementary_context: supplementaryFromWorkspace(ws),
        }),
      });
      const data = (await res.json()) as {
        consent_markdown?: string;
        missing_elements?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Consent generation failed");
      setWs((w) => ({
        ...w,
        phase: "consent",
        consent_markdown: data.consent_markdown ?? "",
        consent_missing: data.missing_elements ?? [],
      }));
    } catch {
      setWs((w) => ({
        ...w,
        consent_markdown: "*Could not generate consent. Check API configuration.*",
        consent_missing: [],
      }));
    } finally {
      setConsentBusy(false);
    }
  }

  async function runCompliance() {
    setComplianceBusy(true);
    setRightTab("compliance");
    try {
      const res = await fetch("/api/prototype/ai-intake/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: ws.protocol,
          consent_markdown: ws.consent_markdown ?? "",
          supplementary_context: supplementaryFromWorkspace(ws),
        }),
      });
      const data = (await res.json()) as {
        predicted_category?: string;
        flags?: AiWorkspaceState["compliance_flags"];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Compliance review failed");
      setWs((w) => ({
        ...w,
        phase: "compliance",
        predicted_category:
          data.predicted_category === "exempt" || data.predicted_category === "expedited" || data.predicted_category === "full_board"
            ? data.predicted_category
            : null,
        compliance_flags: data.flags ?? [],
      }));
    } catch {
      setWs((w) => ({
        ...w,
        compliance_flags: [
          {
            id: "err",
            severity: "error",
            message: "Compliance review could not be completed.",
            section_key: "general",
          },
        ],
      }));
    } finally {
      setComplianceBusy(false);
    }
  }

  function scrollToSection(key: ProtocolSectionKey | "consent") {
    if (key === "consent") {
      setRightTab("consent");
      return;
    }
    setRightTab("context");
  }

  async function uploadPackageToS3() {
    if (!proposalId) return;
    setPackageS3Error(null);
    setPackageUploading(true);
    try {
      const md = buildProposalPackageMarkdown(ws, suggestedTitle);
      const file = new File([md], proposalPackageFilename(proposalId), {
        type: "text/markdown",
      });
      await db.presignUploadProposalFile(proposalId, file);
    } catch (e) {
      setPackageS3Error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPackageUploading(false);
    }
  }

  async function submitFinal() {
    if (!proposalId) return;
    if (!complianceComplete) {
      setRightTab("compliance");
      return;
    }
    if (!proposalReviewAcknowledged) {
      setRightTab("package");
      return;
    }
    setSubmitting(true);
    setPackageS3Error(null);
    try {
      const merged = buildFormDataFromAiWorkspace(
        { ...ws, phase: "submit" },
        suggestedTitle,
      );
      const title = suggestedTitle.trim() || "Draft study";
      const md = buildProposalPackageMarkdown({ ...ws, phase: "submit" }, suggestedTitle);
      await db.updateProposal(proposalId, {
        title,
        review_type: ws.predicted_category ?? undefined,
        form_data: {
          ...merged,
          submission_snapshot: {
            markdown: md,
            file_name: proposalPackageFilename(proposalId),
            submitted_at: new Date().toISOString(),
          },
        },
      });
      const file = new File([md], proposalPackageFilename(proposalId), {
        type: "text/markdown",
      });
      try {
        await db.presignUploadProposalFile(proposalId, file);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not upload the proposal package to storage.";
        setPackageS3Error(msg);
        setSubmitting(false);
        setRightTab("package");
        return;
      }
      await db.submitProposal(proposalId);
      router.push(`/dashboard/proposals/${proposalId}?submitted=1&tab=documents`);
      router.refresh();
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] max-h-[calc(100dvh-8rem)] min-h-0 flex-col overflow-hidden bg-[#fafaf9] sm:h-[calc(100dvh-7rem)] sm:max-h-[calc(100dvh-7rem)] dark:bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md md:px-6">
        <Button variant="ghost" size="icon" className="cursor-pointer shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h1 className="truncate font-[var(--font-heading)] text-lg font-medium tracking-tight md:text-xl">
              AI protocol draft
            </h1>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Intake · workspace · consent · review · proposal package — saved as you work
            {saving ? " · Saving…" : ""}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Input
            placeholder="Study title"
            value={suggestedTitle}
            onChange={(e) => setSuggestedTitle(e.target.value)}
            className="h-9 w-48 rounded-full border-border/80 bg-background text-sm md:w-64"
          />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
        {/* Chat */}
        <div className="flex h-full min-h-[36vh] flex-col border-b border-border/60 md:min-h-0 md:border-b-0 md:border-r">
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Conversational intake
            </span>
            {aiBusy ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Bot className="h-3.5 w-3.5 animate-pulse" aria-hidden />
                AI composing…
              </span>
            ) : null}
          </div>
          <div
            ref={chatScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 [-webkit-overflow-scrolling:touch]"
          >
            <div className="space-y-3 py-4">
              <AnimatePresence initial={false}>
                {ws.messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      m.role === "user"
                        ? "ml-auto bg-foreground text-background"
                        : "mr-auto border border-border/80 bg-card text-foreground shadow-sm",
                    )}
                  >
                    {m.content}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          <div className="shrink-0 border-t border-border/60 p-3">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Answer or ask a question…"
                disabled={aiBusy}
                className="h-11 flex-1 rounded-full border-border/80"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void sendChat())}
              />
              <Button size="icon" className="h-11 w-11 shrink-0 cursor-pointer rounded-full" disabled={aiBusy} onClick={() => void sendChat()}>
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer rounded-full text-xs"
                disabled={consentBusy}
                onClick={() => void runConsent()}
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Generate consent form
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer rounded-full text-xs"
                disabled={complianceBusy}
                onClick={() => void runCompliance()}
              >
                <Scale className="mr-1.5 h-3.5 w-3.5" />
                Run compliance check
              </Button>
            </div>
          </div>
        </div>

        {/* Context + outputs */}
        <div className="flex h-full min-h-[36vh] flex-col bg-white md:min-h-0 dark:bg-muted/20">
          <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-2 py-2">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {(
                [
                  ["context", "Workspace", Library],
                  ["consent", "Consent", ShieldCheck],
                  ["compliance", "Review", Scale],
                  ["package", "Proposal", FileDown],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRightTab(key)}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    rightTab === key
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {ws.phase === "compliance" && ws.predicted_category ? (
              <span className="ml-auto hidden rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
                Predicted: {ws.predicted_category.replace("_", " ")}
              </span>
            ) : null}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-4 md:p-6">
              {rightTab === "context" ? (
                <div className="space-y-6">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <StickyNote className="h-3.5 w-3.5" />
                      Notes for the AI
                    </div>
                    <Textarea
                      value={ws.context_notes}
                      onChange={(e) => setWs((w) => ({ ...w, context_notes: e.target.value }))}
                      placeholder="Grant boilerplate, prior IRB stipulations, lab SOPs, recruitment copy, anything Gemini should treat as ground truth alongside the chat…"
                      rows={6}
                      className="min-h-[120px] resize-y rounded-2xl border-border/80 bg-background text-sm leading-relaxed"
                    />
                    <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
                      Notes and uploads are included on every AI call (intake, consent, compliance). There is
                      no separate on-screen “protocol snapshot”—the model keeps structured fields internally;
                      if it asks you to confirm something, answer here or add detail in notes.
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Upload className="h-3.5 w-3.5" />
                      Upload materials
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      accept=".pdf,.txt,.md,.csv,.json,.html,.htm,text/plain,application/pdf"
                      multiple
                      onChange={(e) => void ingestFiles(e.target.files)}
                    />
                    <button
                      type="button"
                      disabled={ingestBusy || ws.context_attachments.length >= MAX_ATTACHMENTS}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void ingestFiles(e.dataTransfer.files);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center transition-colors hover:border-border hover:bg-muted/30",
                        (ingestBusy || ws.context_attachments.length >= MAX_ATTACHMENTS) &&
                          "pointer-events-none opacity-50",
                      )}
                    >
                      {ingestBusy ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Drop files here or click to upload
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        PDF or plain text · up to 6 MB each · max {MAX_ATTACHMENTS} files · text is used as AI
                        context and saved with your draft
                      </p>
                    </button>
                    {ingestError ? (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{ingestError}</p>
                    ) : null}
                    {ws.context_attachments.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {ws.context_attachments.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-start justify-between gap-2 rounded-xl border border-border/80 bg-card px-3 py-2 text-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{a.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {a.text.length.toLocaleString()} characters sent to the model
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="shrink-0 cursor-pointer"
                              onClick={() => removeAttachment(a.id)}
                              aria-label={`Remove ${a.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {rightTab === "consent" ? (
                <div className="space-y-4">
                  {consentBusy ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating consent at ~8th grade reading level…
                    </div>
                  ) : null}
                  {ws.consent_missing.length > 0 ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        Highlight — elements to strengthen
                      </p>
                      <ul className="list-inside list-disc space-y-1 text-sm text-amber-900/90 dark:text-amber-100/90">
                        {ws.consent_missing.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <Textarea
                    value={ws.consent_markdown ?? ""}
                    onChange={(e) => setWs((w) => ({ ...w, consent_markdown: e.target.value }))}
                    rows={24}
                    className="min-h-[320px] rounded-2xl border-border/80 bg-background font-mono text-sm leading-relaxed"
                    placeholder="Consent form will appear here…"
                  />
                </div>
              ) : null}

              {rightTab === "compliance" ? (
                <div className="space-y-4">
                  {complianceBusy ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing against 45 CFR 46 heuristics…
                    </div>
                  ) : null}
                  {ws.compliance_flags.length === 0 && !complianceBusy ? (
                    <p className="text-sm text-muted-foreground">Run a compliance check to see flags.</p>
                  ) : null}
                  <ul className="space-y-2">
                    {ws.compliance_flags.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (f.section_key === "general") return;
                            scrollToSection(f.section_key as ProtocolSectionKey | "consent");
                          }}
                          className={cn(
                            "w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                            f.severity === "error"
                              ? "border-red-500/40 bg-red-500/5"
                              : f.severity === "warning"
                                ? "border-amber-500/40 bg-amber-500/5"
                                : "border-border/80 bg-card",
                            f.section_key !== "general" ? "cursor-pointer hover:bg-muted/50" : "",
                          )}
                        >
                          <span className="font-medium capitalize text-foreground">{f.severity}</span>
                          <span className="mx-2 text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{f.section_key}</span>
                          <p className="mt-1 text-foreground">{f.message}</p>
                          {f.cfr_reference ? (
                            <p className="mt-1 text-xs text-muted-foreground">{f.cfr_reference}</p>
                          ) : null}
                          {f.actionable ? (
                            <p className="mt-1 text-xs text-primary">{f.actionable}</p>
                          ) : null}
                          {f.section_key !== "general" ? (
                            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
                              {f.section_key === "consent" ? "Open consent" : "Open workspace"}
                              <ChevronRight className="h-3 w-3" />
                            </p>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rightTab === "package" ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-[var(--font-heading)] text-sm font-medium">Completed proposal package</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Review everything that will be stored with your submission. Download a Markdown copy
                      anytime. Submit saves the package to Postgres and uploads the same Markdown to S3
                      (server-side API — no Edge Function JWT). Use the button below to upload to S3 only
                      before submitting.
                    </p>
                  </div>
                  {!proposalId ? (
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Save a draft first (wait for “Saving…” to finish) before downloading or uploading the
                      package.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer rounded-full"
                        onClick={() =>
                          downloadProposalPackageMarkdown(
                            packageMarkdown,
                            proposalPackageFilename(proposalId),
                          )
                        }
                      >
                        <FileDown className="mr-1.5 h-3.5 w-3.5" />
                        Download .md
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="cursor-pointer rounded-full"
                        disabled={packageUploading}
                        onClick={() => void uploadPackageToS3()}
                      >
                        {packageUploading ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Save to proposal files (S3)
                      </Button>
                    </div>
                  )}
                  {packageS3Error ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">{packageS3Error}</p>
                  ) : null}
                  <div className="max-h-[min(52vh,28rem)] overflow-auto rounded-2xl border border-border/80 bg-muted/30 p-4">
                    <pre className="whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-relaxed text-foreground">
                      {packageMarkdown}
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                      <h3 className="font-[var(--font-heading)] text-sm font-medium">Submit for IRB review</h3>
                      {!proposalId ? (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          Waiting for proposal to finish saving…
                        </p>
                      ) : !complianceComplete ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Run a <strong className="text-foreground">compliance check</strong> from the chat bar
                          or the Review tab. After you have a predicted category, return here to review the
                          package and submit.
                        </p>
                      ) : (
                        <>
                          <p className="mt-2 text-sm text-muted-foreground">
                            <strong className="text-foreground">Predicted category:</strong>{" "}
                            {ws.predicted_category!.replace("_", " ")} (informational) ·{" "}
                            <strong className="text-foreground">Title:</strong> {suggestedTitle || "Draft study"}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Submit saves this package in the database (snapshot) and uploads the same file to
                            S3 via the app server. If the upload fails, fix the message above and try again.
                          </p>
                          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-muted/30 p-3 text-sm">
                            <input
                              type="checkbox"
                              className="mt-1 size-4 shrink-0 cursor-pointer rounded border-border accent-foreground"
                              checked={proposalReviewAcknowledged}
                              onChange={(e) => setProposalReviewAcknowledged(e.target.checked)}
                            />
                            <span className="text-foreground">
                              I have reviewed the complete proposal package above (including the Markdown
                              preview). I understand it will be stored with my submission.
                            </span>
                          </label>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              className="cursor-pointer rounded-full"
                              disabled={submitting || !canSubmitProposal}
                              onClick={() => void submitFinal()}
                              title={
                                !proposalReviewAcknowledged
                                  ? "Confirm you reviewed the proposal package"
                                  : undefined
                              }
                            >
                              {submitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="mr-2 h-4 w-4" />
                              )}
                              Submit proposal
                            </Button>
                            <Link
                              href="/dashboard/proposals"
                              className={cn(
                                buttonVariants({ variant: "outline" }),
                                "inline-flex cursor-pointer rounded-full no-underline",
                              )}
                            >
                              Cancel
                            </Link>
                          </div>
                        </>
                      )}
                  </div>
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
