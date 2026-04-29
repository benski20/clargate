"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  FileCheck2,
  FileDown,
  FileUp,
  FileText,
  Library,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Upload,
  X,
  MessageCircle,
  Save,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ProposalMarkdownPreview } from "@/components/proposals/ProposalMarkdownPreview";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { db } from "@/lib/database";
import type { ProposalStatus } from "@/lib/types";
import { supplementaryFromWorkspace } from "@/lib/ai-context";
import {
  emptyAiWorkspace,
  normalizeAiWorkspace,
  normalizeComplianceFlags,
  protocolHasReviewContent,
  PROTOCOL_SECTION_KEYS,
  PROTOCOL_SECTION_LABELS,
  type AiChatMessage,
  type ExtraMaterial,
  type AiWorkspaceState,
  type ProtocolSectionKey,
} from "@/lib/ai-proposal-types";
import { buildFormDataFromAiWorkspace } from "@/lib/ai-proposal-merge";
import {
  buildProposalPackageMarkdown,
  downloadProposalPackagePdf,
  proposalPackageDocxFilename,
  proposalPackagePdfFilename,
  buildProposalPackagePdfBytes,
} from "@/lib/ai-proposal-package-markdown";
import {
  MAX_INGEST_BYTES_PER_FILE,
  MAX_UPLOAD_ATTACHMENTS_CHAT,
  MAX_UPLOAD_ATTACHMENTS_MATERIALS,
} from "@/lib/ai-upload-limits";

const ProposalCanvasEditor = dynamic(
  () => import("@/components/proposals/ProposalCanvasEditor").then((m) => m.ProposalCanvasEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-[min(70vh,48rem)] animate-pulse rounded-none bg-muted/10" />,
  },
);

/** Upload path only: single-screen wizard steps (presentation). Index 0–4. */
const UPLOAD_WIZARD_STEPS = [
  { label: "Materials", description: "Upload files and run AI review" },
  { label: "AI review", description: "Section-by-section review notes" },
  { label: "Consent", description: "Consent draft" },
  { label: "Compliance", description: "Checks and revision ideas" },
  { label: "Extra materials", description: "Additional documents for reviewers" },
  { label: "Submit", description: "Submit to the IRB" },
] as const;

/** Compact labels for the header step strip only */
const UPLOAD_WIZARD_STRIP_LABELS = ["Materials", "Review", "Consent", "Compliance", "Extra", "Submit"] as const;

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

export function AiIntakeWorkspace({
  onBack,
  variant: variantProp = "chat",
  existingProposalId = null,
}: {
  onBack: () => void;
  /** Upload-first path: files + “Run AI review” instead of conversational chat. */
  variant?: "chat" | "upload";
  /** Load an existing draft or a proposal in “revisions requested” for edit + submit / resubmit. */
  existingProposalId?: string | null;
}) {
  const router = useRouter();
  /** When reopening a saved draft, `form_data.entry_mode` wins over the initial `variant` prop. */
  const [resolvedVariant, setResolvedVariant] = useState<"chat" | "upload" | null>(null);
  useEffect(() => {
    if (!existingProposalId) setResolvedVariant(null);
  }, [existingProposalId]);
  const effectiveVariant = resolvedVariant ?? variantProp;
  const maxAttachments =
    effectiveVariant === "upload" ? MAX_UPLOAD_ATTACHMENTS_MATERIALS : MAX_UPLOAD_ATTACHMENTS_CHAT;
  const maxFileBytes = MAX_INGEST_BYTES_PER_FILE;
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
  const [packageViewMode, setPackageViewMode] = useState<"preview" | "source">("preview");
  const [consentViewMode, setConsentViewMode] = useState<"preview" | "source">("preview");
  const [revisionSuggestions, setRevisionSuggestions] = useState<string[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [uploadChatOpen, setUploadChatOpen] = useState(false);
  const [uploadChatMessages, setUploadChatMessages] = useState<AiChatMessage[]>([]);
  const [uploadChatInput, setUploadChatInput] = useState("");
  const [uploadChatBusy, setUploadChatBusy] = useState(false);
  const [leftPaneCollapsed, setLeftPaneCollapsed] = useState(false);
  const [uploadSubmitConfirmOpen, setUploadSubmitConfirmOpen] = useState(false);
  const [uploadSubmitConfirmed, setUploadSubmitConfirmed] = useState(false);
  /** Upload variant: which wizard screen is shown (0–4). Does not replace `rightTab` for data logic. */
  const [uploadWizardStep, setUploadWizardStep] = useState(0);
  /** Chat ("Draft with AI") variant: wizard step index (0–6). */
  const [draftWizardStep, setDraftWizardStep] = useState(0);
  const [uploadAiReviewConsentDialogOpen, setUploadAiReviewConsentDialogOpen] = useState(false);
  const bootRef = useRef(false);
  const prevReviewBusyRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const uploadChatScrollRef = useRef<HTMLDivElement>(null);
  const uploadChatContentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  /** Original upload binaries (session only); used to push materials to proposal file storage on Save. */
  const attachmentOriginalFilesRef = useRef<Map<string, File>>(new Map());
  const extraMaterialsOriginalFilesRef = useRef<Map<string, File>>(new Map());

  const packageMarkdown = useMemo(
    () =>
      buildProposalPackageMarkdown(ws, suggestedTitle, {
        includeConsent: effectiveVariant === "upload",
        includeCompliance: effectiveVariant === "upload",
      }),
    [ws, suggestedTitle, effectiveVariant],
  );

  const [packageDraftMarkdown, setPackageDraftMarkdown] = useState<string>("");
  const [packageDraftDirty, setPackageDraftDirty] = useState(false);
  useEffect(() => {
    // Keep the draft package synced to generated output until the user edits it.
    if (!packageDraftDirty) setPackageDraftMarkdown(packageMarkdown);
  }, [packageMarkdown]);

  const [hydrationStatus, setHydrationStatus] = useState<"loading" | "ready" | "no_workspace">(() =>
    existingProposalId ? "loading" : "ready",
  );
  const [loadedProposalStatus, setLoadedProposalStatus] = useState<ProposalStatus | null>(null);

  const isRevisionResubmit = loadedProposalStatus === "revisions_requested";

  const hasStudyTitle = suggestedTitle.trim().length > 0;
  /** Upload path only: block workspace until a study title is entered (AI draft/chat has no title gate). */
  const blockWorkspace =
    effectiveVariant === "upload" && hydrationStatus === "ready" && !hasStudyTitle;

  useEffect(() => {
    if (blockWorkspace) setUploadChatOpen(false);
  }, [blockWorkspace]);

  const complianceComplete =
    (ws.phase === "compliance" || ws.phase === "submit") && Boolean(ws.predicted_category);

  const canSubmitProposal =
    Boolean(proposalId) && complianceComplete;

  useEffect(() => {
    const prev = prevReviewBusyRef.current;
    if (
      effectiveVariant === "upload" &&
      prev &&
      !reviewBusy &&
      protocolHasReviewContent(ws.protocol) &&
      !leftPaneCollapsed
    ) {
      setLeftPaneCollapsed(true);
    }
    prevReviewBusyRef.current = reviewBusy;
  }, [effectiveVariant, reviewBusy, ws.protocol, leftPaneCollapsed]);

  const persist = useCallback(
    async (next: AiWorkspaceState, title: string): Promise<string | null> => {
      setSaving(true);
      try {
        const merged = buildFormDataFromAiWorkspace(next, title, {
          entryMode: effectiveVariant === "upload" ? "upload_review" : "ai_draft",
        });
        const t = title.trim() || "Draft study";
        if (!proposalId) {
          const created = await db.createProposal(t, merged);
          const newId = created.id as string;
          setProposalId(newId);
          return newId;
        }
        await db.updateProposal(proposalId, { title: t, form_data: merged });
        return proposalId;
      } catch {
        return null;
      } finally {
        setSaving(false);
      }
    },
    [proposalId, effectiveVariant],
  );

  const navigateWorkspaceTab = useCallback(
    (
      tab: "context" | "consent" | "compliance" | "package",
      uploadWizardStepOverride?: number,
    ) => {
      setRightTab(tab);
      if (effectiveVariant !== "upload") return;
      if (uploadWizardStepOverride !== undefined) {
        setUploadWizardStep(uploadWizardStepOverride);
        return;
      }
      if (tab === "context") setUploadWizardStep(1);
      else if (tab === "consent") setUploadWizardStep(2);
      else if (tab === "compliance") setUploadWizardStep(3);
    },
    [effectiveVariant],
  );

  const goToUploadWizardStep = useCallback(
    (stepIndex: number) => {
      if (effectiveVariant !== "upload") return;
      const clamped = Math.max(0, Math.min(5, stepIndex));
      if (clamped === 0) {
        setUploadWizardStep(0);
        return;
      }
      if (clamped === 1) navigateWorkspaceTab("context");
      else if (clamped === 2) navigateWorkspaceTab("consent");
      else if (clamped === 3) navigateWorkspaceTab("compliance");
      else if (clamped === 4) navigateWorkspaceTab("compliance", 4);
      else navigateWorkspaceTab("compliance", 5);
    },
    [effectiveVariant, navigateWorkspaceTab],
  );

  const goToDraftWizardStep = useCallback(
    (stepIndex: number) => {
      if (effectiveVariant === "upload") return;
      const clamped = Math.max(0, Math.min(7, stepIndex));
      setDraftWizardStep(clamped);
    },
    [effectiveVariant],
  );

  useEffect(() => {
    if (effectiveVariant === "upload") return;
    // Keep the underlying tab state in sync so existing sections render unchanged.
    if (draftWizardStep === 0) setRightTab("context");
    else if (draftWizardStep === 3) setRightTab("consent");
    else if (draftWizardStep === 4) setRightTab("package");
    else if (draftWizardStep === 5) setRightTab("compliance");
    else if (draftWizardStep === 6) setRightTab("context");
    else if (draftWizardStep === 7) setRightTab("compliance");
  }, [draftWizardStep, effectiveVariant]);

  /**
   * Uploads any context attachments that have local files but no `proposal_documents` row yet,
   * then returns workspace with `document_id` / `s3_key` filled in for persistence.
   */
  async function syncOriginalAttachmentsToStorage(
    targetProposalId: string,
    workspace: AiWorkspaceState,
  ): Promise<{ workspace: AiWorkspaceState; uploaded: number }> {
    const updates: { id: string; document_id: string; s3_key: string }[] = [];
    for (const att of workspace.context_attachments) {
      if (att.document_id) continue;
      const orig = attachmentOriginalFilesRef.current.get(att.id);
      if (!orig) continue;
      const res = await db.presignUploadProposalFile(targetProposalId, orig);
      updates.push({ id: att.id, document_id: res.document_id, s3_key: res.s3_key });
    }
    if (updates.length === 0) {
      return { workspace, uploaded: 0 };
    }
    for (const u of updates) {
      attachmentOriginalFilesRef.current.delete(u.id);
    }
    const next: AiWorkspaceState = {
      ...workspace,
      context_attachments: workspace.context_attachments.map((a) => {
        const u = updates.find((x) => x.id === a.id);
        return u ? { ...a, document_id: u.document_id, s3_key: u.s3_key } : a;
      }),
    };
    return { workspace: next, uploaded: updates.length };
  }

  async function syncExtraMaterialsToStorage(
    targetProposalId: string,
    workspace: AiWorkspaceState,
  ): Promise<{ workspace: AiWorkspaceState; uploaded: number }> {
    const updates: { id: string; document_id: string; s3_key: string }[] = [];
    for (const m of workspace.extra_materials) {
      if (m.document_id) continue;
      if (m.source_context_attachment_id) {
        const src = workspace.context_attachments.find((a) => a.id === m.source_context_attachment_id);
        if (src?.document_id && src.s3_key) {
          updates.push({ id: m.id, document_id: src.document_id, s3_key: src.s3_key });
          continue;
        }
      }
      const orig = extraMaterialsOriginalFilesRef.current.get(m.id);
      if (!orig) continue;
      const res = await db.presignUploadProposalFile(targetProposalId, orig);
      updates.push({ id: m.id, document_id: res.document_id, s3_key: res.s3_key });
    }
    if (updates.length === 0) return { workspace, uploaded: 0 };
    for (const u of updates) {
      extraMaterialsOriginalFilesRef.current.delete(u.id);
    }
    const next: AiWorkspaceState = {
      ...workspace,
      extra_materials: workspace.extra_materials.map((m) => {
        const u = updates.find((x) => x.id === m.id);
        return u ? { ...m, document_id: u.document_id, s3_key: u.s3_key } : m;
      }),
    };
    return { workspace: next, uploaded: updates.length };
  }

  /** Saves workspace to the database and uploads the Markdown record to proposal file storage. */
  async function saveDraftAndFiles() {
    if (effectiveVariant === "upload" && !suggestedTitle.trim()) return;
    setPackageS3Error(null);
    const id = await persist(ws, suggestedTitle);
    if (!id) return;
    setPackageUploading(true);
    try {
      const { workspace: wsWithCtx, uploaded: uploadedCtx } = await syncOriginalAttachmentsToStorage(id, ws);
      const { workspace: wsSynced, uploaded: uploadedExtra } = await syncExtraMaterialsToStorage(id, wsWithCtx);
      if (uploadedCtx + uploadedExtra > 0) {
        setWs(wsSynced);
        await persist(wsSynced, suggestedTitle);
      }
    } catch (e) {
      setPackageS3Error(e instanceof Error ? e.message : "Could not save to proposal files.");
    } finally {
      setPackageUploading(false);
    }
  }

  function focusSubmissionIssue() {
    navigateWorkspaceTab(effectiveVariant === "upload" ? "compliance" : "package");
  }

  useEffect(() => {
    if (existingProposalId && hydrationStatus !== "ready") return;
    if (effectiveVariant === "upload" && !suggestedTitle.trim()) return;
    const t = setTimeout(() => {
      void persist(ws, suggestedTitle);
    }, 900);
    return () => clearTimeout(t);
  }, [ws, suggestedTitle, persist, existingProposalId, hydrationStatus, effectiveVariant]);

  useEffect(() => {
    if (!existingProposalId) return;
    let cancelled = false;
    setHydrationStatus("loading");
    (async () => {
      try {
        const p = await db.getProposal(existingProposalId);
        if (cancelled) return;
        if (!p) {
          router.replace("/dashboard/proposals");
          return;
        }
        if (p.status !== "draft" && p.status !== "revisions_requested") {
          router.replace(`/dashboard/proposals/${existingProposalId}`);
          return;
        }
        const fd = p.form_data as Record<string, unknown> | null;
        const persistedEntry =
          fd?.entry_mode === "upload_review" ? "upload" : ("chat" as const);
        setResolvedVariant(persistedEntry);
        if (!fd?.ai_workspace) {
          setHydrationStatus("no_workspace");
          setLoadedProposalStatus(p.status);
          return;
        }
        let next = normalizeAiWorkspace(fd.ai_workspace);
        const rt = p.review_type;
        if (rt === "exempt" || rt === "expedited" || rt === "full_board") {
          next = {
            ...next,
            predicted_category: next.predicted_category ?? rt,
          };
        }
        if (next.phase === "submit") {
          next = { ...next, phase: "compliance" };
        }
        setWs(next);
        setSuggestedTitle(p.title || "");
        setProposalId(p.id);
        setLoadedProposalStatus(p.status);
        setHydrationStatus("ready");
      } catch {
        if (!cancelled) router.replace("/dashboard/proposals");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingProposalId, router]);

  useLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const scroll = () => {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    };
    scroll();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(scroll);
    });
    const inner = chatContentRef.current;
    const ro =
      inner &&
      new ResizeObserver(() => {
        scroll();
      });
    if (inner && ro) ro.observe(inner);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
    };
  }, [ws.messages, aiBusy]);

  useEffect(() => {
    if (effectiveVariant === "upload" && rightTab === "package") {
      navigateWorkspaceTab("context");
    }
  }, [effectiveVariant, rightTab, navigateWorkspaceTab]);

  useLayoutEffect(() => {
    const el = uploadChatScrollRef.current;
    if (!el || effectiveVariant !== "upload") return;
    const scroll = () => {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    };
    scroll();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(scroll);
    });
    const inner = uploadChatContentRef.current;
    const ro =
      inner &&
      new ResizeObserver(() => {
        scroll();
      });
    if (inner && ro) ro.observe(inner);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
    };
  }, [uploadChatMessages, uploadChatBusy, effectiveVariant]);

  useEffect(() => {
    if (effectiveVariant === "upload") return;
    if (existingProposalId) return;
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
  }, [effectiveVariant, existingProposalId]);

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || aiBusy) return;
    setChatInput("");
    const history = [...ws.messages, { role: "user" as const, content: text }];
    setWs((w) => ({ ...w, messages: history }));
    setAiBusy(true);
    try {
      chatAbortRef.current?.abort();
      const ac = new AbortController();
      chatAbortRef.current = ac;
      const sup = supplementaryFromWorkspace(ws);
      // Add a placeholder assistant message we can stream into.
      setWs((w) => ({ ...w, messages: [...w.messages, { role: "assistant", content: "" }] }));
      const res = await fetch("/api/prototype/ai-intake/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        signal: ac.signal,
        body: JSON.stringify({
          messages: ws.messages,
          protocol: ws.protocol,
          supplementary_context: sup,
          user_message: text,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Chat failed");
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const updateAssistant = (delta: string) => {
        if (!delta) return;
        setWs((w) => {
          const msgs = [...w.messages];
          const i = msgs.length - 1;
          if (i < 0 || msgs[i].role !== "assistant") return w;
          msgs[i] = { ...msgs[i], content: msgs[i].content + delta };
          return { ...w, messages: msgs };
        });
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // SSE frames separated by blank line. We only parse `data: ...`.
        let idx = 0;
        while (true) {
          const sep = buf.indexOf("\n\n", idx);
          if (sep === -1) break;
          const frame = buf.slice(idx, sep);
          idx = sep + 2;
          const line = frame
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const json = line.slice(5).trim();
          const evt = JSON.parse(json) as
            | { t: string }
            | {
                done: true;
                assistant_message?: string;
                protocol?: AiWorkspaceState["protocol"];
                suggested_title?: string;
                error?: string;
              };
          if ("t" in evt) {
            updateAssistant(evt.t);
          } else if ("done" in evt && evt.done) {
            // Prefer the streamed text to avoid a visible "swap" at the end.
            const finalText = (evt.assistant_message ?? "").trim();
            setWs((w) => {
              const msgs = [...w.messages];
              const i = msgs.length - 1;
              if (i >= 0 && msgs[i].role === "assistant") {
                const streamed = (msgs[i].content ?? "").trim();
                const shouldReplace =
                  !streamed ||
                  streamed.length < 12 ||
                  (finalText && finalText.startsWith(streamed));
                msgs[i] = {
                  ...msgs[i],
                  content: shouldReplace ? (finalText || msgs[i].content) : msgs[i].content,
                };
              }
              return { ...w, protocol: evt.protocol ?? w.protocol, messages: msgs };
            });
            if (evt.suggested_title) setSuggestedTitle(evt.suggested_title);
          } else if ("error" in evt && evt.error) {
            throw new Error(evt.error);
          }
        }
        buf = buf.slice(idx);
      }
    } catch {
      setWs((w) => ({
        ...w,
        messages: w.messages.map((m, idx) =>
          idx === w.messages.length - 1 && m.role === "assistant" && !m.content
            ? { ...m, content: "Something went wrong. Please try again." }
            : m,
        ),
      }));
    } finally {
      setAiBusy(false);
    }
  }

  async function sendUploadAssistantMessage() {
    if (!suggestedTitle.trim()) return;
    const text = uploadChatInput.trim();
    if (!text || uploadChatBusy || effectiveVariant !== "upload") return;
    const historyForApi = [...uploadChatMessages];
    setUploadChatInput("");
    setUploadChatMessages([...historyForApi, { role: "user", content: text }]);
    setUploadChatBusy(true);
    try {
      uploadAbortRef.current?.abort();
      const ac = new AbortController();
      uploadAbortRef.current = ac;
      // Placeholder assistant message for streaming.
      setUploadChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      const res = await fetch("/api/prototype/ai-intake/upload-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        signal: ac.signal,
        body: JSON.stringify({
          messages: historyForApi,
          user_message: text,
          protocol: ws.protocol,
          supplementary_context: supplementaryFromWorkspace(ws),
          compliance_flags: ws.compliance_flags,
          revision_suggestions: revisionSuggestions,
          consent_markdown: ws.consent_markdown,
          suggested_title: suggestedTitle,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Assistant failed");
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const updateAssistant = (delta: string) => {
        if (!delta) return;
        setUploadChatMessages((prev) => {
          const next = [...prev];
          const i = next.length - 1;
          if (i < 0 || next[i].role !== "assistant") return prev;
          next[i] = { ...next[i], content: (next[i].content ?? "") + delta };
          return next;
        });
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx = 0;
        while (true) {
          const sep = buf.indexOf("\n\n", idx);
          if (sep === -1) break;
          const frame = buf.slice(idx, sep);
          idx = sep + 2;
          const line = frame
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const json = line.slice(5).trim();
          const evt = JSON.parse(json) as { t?: string; done?: true; error?: string };
          if (evt.t) updateAssistant(evt.t);
          if (evt.error) throw new Error(evt.error);
        }
        buf = buf.slice(idx);
      }
    } catch {
      setUploadChatMessages((prev) => [
        ...prev.map((m, idx) =>
          idx === prev.length - 1 && m.role === "assistant" && !m.content
            ? {
                ...m,
                content: "I could not reach the assistant. Check your connection and API configuration.",
              }
            : m,
        ),
      ]);
    } finally {
      setUploadChatBusy(false);
    }
  }

  async function ingestFiles(fileList: FileList | null) {
    if (effectiveVariant === "upload" && !suggestedTitle.trim()) return;
    if (!fileList?.length || ingestBusy) return;
    setIngestError(null);
    setIngestBusy(true);
    const additions: AiWorkspaceState["context_attachments"] = [];
    try {
      let remaining = maxAttachments - ws.context_attachments.length;
      if (remaining <= 0) {
        setIngestError(`Maximum ${maxAttachments} files.`);
        return;
      }

      for (const file of Array.from(fileList)) {
        if (remaining <= 0) {
          setIngestError(`Maximum ${maxAttachments} files.`);
          break;
        }
        if (file.size > maxFileBytes) {
          setIngestError(
            `"${file.name}" is too large (max ${Math.round(maxFileBytes / (1024 * 1024))} MB per file for analysis).`,
          );
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
        } else if (
          mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          name.toLowerCase().endsWith(".docx")
        ) {
          const base64 = await blobToBase64(file);
          const res = await fetch("/api/prototype/ai-intake/ingest-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              mimeType:
                mime || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              base64,
            }),
          });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) {
            err = data.error || `Could not extract Word document: ${name}`;
          } else {
            text = (data.text || "").trim();
          }
        } else {
          err = `"${name}" is not a supported type (PDF, Word .docx, or plain text).`;
        }

        if (err) {
          setIngestError(err);
          continue;
        }
        if (!text) {
          setIngestError(`No text extracted from "${name}".`);
          continue;
        }

        const newId = crypto.randomUUID();
        additions.push({
          id: newId,
          name,
          mimeType: mime || "application/octet-stream",
          text,
        });
        attachmentOriginalFilesRef.current.set(newId, file);
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
    attachmentOriginalFilesRef.current.delete(id);
    setWs((w) => ({
      ...w,
      context_attachments: w.context_attachments.filter((a) => a.id !== id),
    }));
  }

  function removeExtraMaterial(id: string) {
    extraMaterialsOriginalFilesRef.current.delete(id);
    setWs((w) => ({ ...w, extra_materials: w.extra_materials.filter((m) => m.id !== id) }));
  }

  async function ingestExtraMaterialFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const additions: ExtraMaterial[] = [];
    for (const file of Array.from(fileList)) {
      if (!file || !(file instanceof File) || file.size === 0) continue;
      const id = crypto.randomUUID();
      additions.push({
        id,
        name: file.name || "upload.bin",
        mimeType: file.type || "application/octet-stream",
        description: "",
      });
      extraMaterialsOriginalFilesRef.current.set(id, file);
    }
    if (additions.length > 0) {
      setWs((w) => ({ ...w, extra_materials: [...w.extra_materials, ...additions] }));
    }
  }

  function attachContextAsExtraMaterial(attId: string) {
    const att = ws.context_attachments.find((a) => a.id === attId);
    if (!att) return;
    const already = ws.extra_materials.some((m) => m.source_context_attachment_id === attId);
    if (already) return;
    setWs((w) => ({
      ...w,
      extra_materials: [
        ...w.extra_materials,
        {
          id: crypto.randomUUID(),
          name: att.name,
          mimeType: att.mimeType,
          description: "",
          source_context_attachment_id: attId,
          document_id: att.document_id,
          s3_key: att.s3_key,
        },
      ],
    }));
  }

  async function runConsent() {
    setConsentBusy(true);
    navigateWorkspaceTab("consent");
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
    navigateWorkspaceTab("compliance");
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
        compliance_flags: normalizeComplianceFlags(data.flags ?? []),
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

  async function runDraftAiReview() {
    setReviewBusy(true);
    setRevisionSuggestions([]);
    setIngestError(null);
    try {
      // Compliance (and category) using current protocol + consent (if present).
      const compRes = await fetch("/api/prototype/ai-intake/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: ws.protocol,
          consent_markdown: ws.consent_markdown ?? "",
          supplementary_context: supplementaryFromWorkspace(ws),
        }),
      });
      const compData = (await compRes.json()) as {
        predicted_category?: string;
        flags?: AiWorkspaceState["compliance_flags"];
        error?: string;
      };
      if (!compRes.ok) throw new Error(compData.error || "Compliance review failed");
      const cat =
        compData.predicted_category === "exempt" ||
        compData.predicted_category === "expedited" ||
        compData.predicted_category === "full_board"
          ? compData.predicted_category
          : null;
      setWs((w) => ({
        ...w,
        phase: "compliance",
        predicted_category: cat,
        compliance_flags: normalizeComplianceFlags(compData.flags ?? []),
      }));

      const revRes = await fetch("/api/prototype/ai-intake/revision-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: ws.protocol,
          compliance_flags: normalizeComplianceFlags(compData.flags ?? []),
        }),
      });
      const revData = (await revRes.json()) as { suggestions?: string[] };
      if (revRes.ok && Array.isArray(revData.suggestions)) {
        setRevisionSuggestions(revData.suggestions);
      }
    } catch (e) {
      setIngestError(e instanceof Error ? e.message : "AI review failed.");
    } finally {
      setReviewBusy(false);
    }
  }

  function requestRunAiReview() {
    if (!suggestedTitle.trim()) return;
    if (ws.context_attachments.length === 0) {
      setIngestError("Add at least one PDF or text file.");
      return;
    }
    setUploadAiReviewConsentDialogOpen(true);
  }

  async function executeFullAiReview(skipConsentGeneration: boolean) {
    if (!suggestedTitle.trim()) return;
    if (ws.context_attachments.length === 0) {
      setIngestError("Add at least one PDF or text file.");
      return;
    }
    const baseWithPreference: AiWorkspaceState = {
      ...ws,
      consent_generation_declined: skipConsentGeneration,
    };
    setWs(baseWithPreference);
    setReviewBusy(true);
    setIngestError(null);
    setRevisionSuggestions([]);
    navigateWorkspaceTab("context");
    try {
      let next: AiWorkspaceState = baseWithPreference;
      const combined = next.context_attachments.map((a) => `## ${a.name}\n${a.text}`).join("\n\n");
      const synRes = await fetch("/api/prototype/ai-intake/synthesize-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: combined,
          title: suggestedTitle,
          mode: "upload_review",
        }),
      });
      const synData = (await synRes.json()) as {
        protocol?: AiWorkspaceState["protocol"];
        error?: string;
      };
      if (!synRes.ok) throw new Error(synData.error || "Could not generate review notes from materials.");

      next = {
        ...next,
        protocol: synData.protocol ?? next.protocol,
      };
      setWs(next);

      if (skipConsentGeneration) {
        next = {
          ...next,
          phase: "consent",
          consent_markdown:
            "*No AI-generated consent document.* You skipped consent draft generation for this proposal.",
          consent_missing: [],
        };
        setWs(next);
      } else {
        const consentRes = await fetch("/api/prototype/ai-intake/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            protocol: next.protocol,
            supplementary_context: supplementaryFromWorkspace(next),
          }),
        });
        const consentData = (await consentRes.json()) as {
          consent_markdown?: string;
          missing_elements?: string[];
          error?: string;
        };
        if (!consentRes.ok) throw new Error(consentData.error || "Consent generation failed");
        next = {
          ...next,
          phase: "consent",
          consent_markdown: consentData.consent_markdown ?? "",
          consent_missing: consentData.missing_elements ?? [],
        };
        setWs(next);
      }

      const compRes = await fetch("/api/prototype/ai-intake/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: next.protocol,
          consent_markdown: next.consent_markdown ?? "",
          supplementary_context: supplementaryFromWorkspace(next),
        }),
      });
      const compData = (await compRes.json()) as {
        predicted_category?: string;
        flags?: AiWorkspaceState["compliance_flags"];
        error?: string;
      };
      if (!compRes.ok) throw new Error(compData.error || "Compliance review failed");
      const cat =
        compData.predicted_category === "exempt" ||
        compData.predicted_category === "expedited" ||
        compData.predicted_category === "full_board"
          ? compData.predicted_category
          : null;
      next = {
        ...next,
        phase: "compliance",
        predicted_category: cat,
        compliance_flags: normalizeComplianceFlags(compData.flags ?? []),
      };
      setWs(next);

      const revRes = await fetch("/api/prototype/ai-intake/revision-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: next.protocol,
          compliance_flags: next.compliance_flags,
        }),
      });
      const revData = (await revRes.json()) as { suggestions?: string[] };
      if (revRes.ok && Array.isArray(revData.suggestions)) {
        setRevisionSuggestions(revData.suggestions);
      }
    } catch (e) {
      setIngestError(e instanceof Error ? e.message : "AI review failed.");
    } finally {
      setReviewBusy(false);
    }
  }

  function scrollToSection(key: ProtocolSectionKey | "consent") {
    if (key === "consent") {
      navigateWorkspaceTab("consent");
      return;
    }
    navigateWorkspaceTab("context");
  }

  async function submitFinal() {
    if (effectiveVariant === "upload" && !suggestedTitle.trim()) return;
    if (!proposalId) return;
    const submitMode = loadedProposalStatus ?? "draft";
    if (!complianceComplete) {
      navigateWorkspaceTab("compliance");
      return;
    }
    setSubmitting(true);
    setPackageS3Error(null);
    try {
      const { workspace: wsWithCtx } = await syncOriginalAttachmentsToStorage(proposalId, ws);
      const { workspace: wsSynced } = await syncExtraMaterialsToStorage(proposalId, wsWithCtx);
      if (wsSynced !== ws) setWs(wsSynced);
      const merged = buildFormDataFromAiWorkspace(
        { ...wsSynced, phase: "submit" },
        suggestedTitle,
        { entryMode: effectiveVariant === "upload" ? "upload_review" : "ai_draft" },
      );
      const title = suggestedTitle.trim() || "Draft study";
      const md =
        effectiveVariant === "upload"
          ? (packageDraftDirty
              ? packageDraftMarkdown
              : buildProposalPackageMarkdown({ ...wsSynced, phase: "submit" }, suggestedTitle, {
                  includeConsent: true,
                  includeCompliance: true,
                }))
          : (packageDraftMarkdown ||
              buildProposalPackageMarkdown({ ...wsSynced, phase: "submit" }, suggestedTitle, {
                includeConsent: false,
                includeCompliance: false,
              }));
      const pdfName = proposalPackagePdfFilename(proposalId, title);
      const docxName = proposalPackageDocxFilename(proposalId, title);
      await db.updateProposal(proposalId, {
        title,
        review_type: wsSynced.predicted_category ?? undefined,
        form_data: {
          ...merged,
          submission_snapshot: {
            markdown: md, // retained for server-side conversions/internal recovery; not surfaced in UI
            file_name: docxName,
            docx_file_name: docxName,
            pdf_file_name: pdfName,
            submitted_at: new Date().toISOString(),
          },
        },
      });
      // Upload PDF package (client-generated) alongside Word.
      try {
        const pdfBytes = await buildProposalPackagePdfBytes(md);
        const copy = new Uint8Array(pdfBytes.byteLength);
        copy.set(pdfBytes);
        const pdfFile = new File([copy.buffer], pdfName, { type: "application/pdf" });
        await db.presignUploadProposalFile(proposalId, pdfFile);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not upload the proposal package as PDF (.pdf).";
        setPackageS3Error(msg);
        setSubmitting(false);
        focusSubmissionIssue();
        return;
      }
      try {
        const docxRes = await fetch(`/api/proposals/${proposalId}/upload-submission-docx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ markdown: md, file_name: docxName }),
        });
        const docxJson = (await docxRes.json().catch(() => ({}))) as { error?: string };
        if (!docxRes.ok) {
          throw new Error(docxJson.error || `Word package upload failed (${docxRes.status})`);
        }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not save the proposal package as Word (.docx).";
        setPackageS3Error(msg);
        setSubmitting(false);
        focusSubmissionIssue();
        return;
      }
      if (submitMode === "revisions_requested") {
        await db.resubmitProposal(proposalId);
        router.push(`/dashboard/proposals/${proposalId}?resubmitted=1&tab=documents`);
      } else {
        await db.submitProposal(proposalId);
        router.push(`/dashboard/proposals/${proposalId}?submitted=1&tab=documents`);
      }
      router.refresh();
    } catch (e) {
      setSubmitting(false);
      setPackageS3Error(e instanceof Error ? e.message : "Submit failed. Try again.");
      focusSubmissionIssue();
    }
  }

  if (existingProposalId && hydrationStatus === "loading") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-background px-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading proposal" />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  if (existingProposalId && hydrationStatus === "no_workspace") {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <Button variant="ghost" size="sm" className="cursor-pointer gap-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <h1 className="font-semibold text-xl tracking-tight">
            Workspace not available
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            This proposal does not have a saved AI workspace (structured protocol, consent, and compliance
            state). Open the proposal, download your submitted Word or PDF file from the Documents
            tab, edit locally, then contact your IRB office if you need to replace files on record.
          </p>
        </div>
      </div>
    );
  }

  const consentDraftSection = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {consentBusy ? (
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          Generating consent…
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          effectiveVariant === "upload" ? "px-0" : "px-6 md:px-8 lg:px-10",
        )}
        role="region"
        aria-label="Consent document"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Consent draft
            </p>
            <p className="text-[0.7rem] text-muted-foreground">
              Rendered like a document. Editing is optional.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-md text-xs shadow-sm"
            onClick={() => setConsentViewMode((m) => (m === "source" ? "preview" : "source"))}
          >
            {consentViewMode === "source" ? "Done" : "Edit"}
          </Button>
        </div>

        <div className="mt-1 min-h-0 flex-1 px-0">
          {consentViewMode === "source" ? (
            <ProposalCanvasEditor
              markdown={ws.consent_markdown ?? ""}
              onMarkdownChange={(md) => setWs((w) => ({ ...w, consent_markdown: md }))}
            />
          ) : (ws.consent_markdown ?? "").trim() ? (
            <div className="rounded-lg bg-background">
              <ProposalMarkdownPreview markdown={ws.consent_markdown ?? ""} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground">
              No consent text yet. Generate it from the workspace, or click{" "}
              <strong className="text-foreground">Edit</strong> to paste your own Markdown.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const complianceReviewSection = (
    <div className="space-y-8">
      {complianceBusy || reviewBusy ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {reviewBusy ? "Running review…" : "Analyzing against 45 CFR 46 heuristics…"}
        </div>
      ) : null}
      {ws.compliance_flags.length === 0 && !complianceBusy && !reviewBusy ? (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground">
          No compliance items yet. Run <strong className="text-foreground">AI review</strong> (or “Compliance
          only”) to generate checks.
        </p>
      ) : (
        <div className="space-y-4">
          {revisionSuggestions.length > 0 ? (
            <details className="group rounded-lg bg-primary/5 px-4 py-3 open:bg-background">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Revision suggestions</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    High-level improvements to reduce reviewer back-and-forth.
                  </p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-foreground">
                {revisionSuggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="space-y-2">
            {[...ws.compliance_flags]
              .sort((a, b) => {
                const order = { error: 0, warning: 1, info: 2 } as const;
                const ao = order[a.severity];
                const bo = order[b.severity];
                if (ao !== bo) return ao - bo;
                if (a.section_key !== b.section_key)
                  return String(a.section_key).localeCompare(String(b.section_key));
                return a.message.localeCompare(b.message);
              })
              .map((f) => {
                const citation = (f.cfr_reference ?? "").trim();
                const suggestion = (f.actionable ?? "").trim();
                const citationLine = citation.length > 120 ? `${citation.slice(0, 120)}…` : citation;
                const suggestionLine = suggestion.length > 120 ? `${suggestion.slice(0, 120)}…` : suggestion;
                const badge =
                  f.severity === "error"
                    ? "Error"
                    : f.severity === "warning"
                      ? "Warning"
                      : "Info";
                return (
                  <details
                    key={f.id}
                    className="group rounded-lg bg-background/70 px-4 py-3 open:bg-background"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                              f.severity === "error"
                                ? "bg-red-500/10 text-red-700 dark:text-red-300"
                                : f.severity === "warning"
                                  ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
                                  : "bg-muted/40 text-muted-foreground",
                            )}
                          >
                            {badge}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {String(f.section_key).replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">{f.message}</p>
                        {citationLine ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            <span className="font-medium text-foreground">Citation:</span> {citationLine}
                          </p>
                        ) : null}
                        {suggestionLine ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            <span className="font-medium text-foreground">Suggestion:</span> {suggestionLine}
                          </p>
                        ) : null}
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    </summary>

                    <div className="mt-3 pt-3">
                      {f.cfr_reference ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          <span className="font-semibold text-foreground">Citation:</span> {f.cfr_reference}
                        </p>
                      ) : null}
                      {f.actionable ? (
                        <p className={cn("mt-2 text-sm leading-relaxed text-foreground", !f.cfr_reference && "mt-0")}>
                          <span className="font-semibold">Suggestion:</span> {f.actionable}
                        </p>
                      ) : null}
                      {f.section_key !== "general" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 cursor-pointer"
                          onClick={() => scrollToSection(f.section_key as ProtocolSectionKey | "consent")}
                        >
                          {f.section_key === "consent"
                            ? "Open consent"
                            : effectiveVariant === "upload"
                              ? "Open AI review"
                              : "Open workspace"}
                        </Button>
                      ) : null}
                    </div>
                  </details>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );

  const extraMaterialsSection = (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Upload any supporting documents you want reviewers to see alongside the proposal package and consent form
          (surveys, recruitment scripts, interview guides, flyers, data instruments, etc.).
        </p>
      </div>

      {ws.context_attachments.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Re-use previously uploaded context files
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ws.context_attachments.map((a) => {
              const picked = ws.extra_materials.some((m) => m.source_context_attachment_id === a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={picked}
                  onClick={() => attachContextAsExtraMaterial(a.id)}
                  className={cn(
                    "flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2 text-left shadow-sm transition-colors",
                    "hover:border-border hover:bg-muted/15",
                    picked && "cursor-not-allowed opacity-50",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                      {picked ? "Already attached" : "Click to attach"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[0.7rem] font-medium text-muted-foreground">
                    {picked ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <input
          type="file"
          className="sr-only"
          id="extra-materials-upload"
          multiple
          onChange={(e) => void ingestExtraMaterialFiles(e.target.files)}
        />
        <label
          htmlFor="extra-materials-upload"
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-background px-4 py-10 text-center shadow-sm transition-colors",
            "hover:border-border hover:bg-muted/20",
          )}
        >
          <FileUp className="h-5 w-5 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Upload extra materials</p>
          <p className="mt-1 text-xs text-muted-foreground">Any file type is allowed.</p>
        </label>
      </div>

      {ws.extra_materials.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attached materials</p>
          <ul className="space-y-3">
            {ws.extra_materials.map((m) => (
              <li key={m.id} className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                      {m.source_context_attachment_id ? "From context uploads" : "Uploaded here"}{" "}
                      {m.document_id ? "· Saved to proposal documents" : null}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 cursor-pointer"
                    onClick={() => removeExtraMaterial(m.id)}
                    aria-label={`Remove ${m.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Description (optional)
                  </p>
                  <Textarea
                    value={m.description}
                    onChange={(e) =>
                      setWs((w) => ({
                        ...w,
                        extra_materials: w.extra_materials.map((x) =>
                          x.id === m.id ? { ...x, description: e.target.value } : x,
                        ),
                      }))
                    }
                    rows={3}
                    className="resize-y rounded-md border-border/40 bg-background text-sm leading-relaxed"
                    placeholder="What is this document and how should reviewers interpret it?"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No extra materials attached. You can continue without them.</p>
      )}
    </div>
  );

  const uploadAiReviewSection = (
    <div className="space-y-4">
      {reviewBusy ? (
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/50 bg-muted/15 px-6 py-14 text-center"
          role="status"
          aria-live="polite"
          aria-label="AI review in progress"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">AI review is generating</p>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-muted-foreground">
              Processing your materials through the AI review pipeline. This may take a minute.
            </p>
          </div>
        </div>
      ) : protocolHasReviewContent(ws.protocol) ? (
        <div className="space-y-2">
          {PROTOCOL_SECTION_KEYS.map((k) => {
            const raw = (ws.protocol[k] ?? "").trim();
            if (!raw) return null;
            const firstLine = raw.split("\n").find((l) => l.trim())?.trim() ?? "";
            const preview = firstLine.length > 140 ? `${firstLine.slice(0, 140)}…` : firstLine;
            return (
              <details
                key={k}
                className="group rounded-lg bg-background/70 px-4 py-3 open:bg-background"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{PROTOCOL_SECTION_LABELS[k]}</p>
                    {preview ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {preview}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-3 pt-3">
                  <ProposalMarkdownPreview markdown={raw} />
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          Run <strong className="text-foreground">AI review</strong> on the Materials step after uploading
          files. Notes will appear here.
        </p>
      )}
    </div>
  );

  const uploadMaterialsWizardSection = (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Step 1 · Materials
        </p>
        <h2 className="font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
          Upload your materials
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Add PDF, Word, or text files and optional notes, then run a structured AI review (protocol notes,
          optional consent draft, compliance checks).
        </p>
      </div>
      {reviewBusy ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          AI review…
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Upload <strong className="text-foreground">PDF, Word (.docx), or Markdown/text</strong> — up to{" "}
        {Math.round(maxFileBytes / (1024 * 1024))} MB per file, {maxAttachments} files max. The AI reviews your
        materials and surfaces observations, consent drafts, and compliance notes{" "}
        <strong className="text-foreground">without replacing or reformatting your originals</strong>.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm,.markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        onChange={(e) => void ingestFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={ingestBusy || reviewBusy || ws.context_attachments.length >= maxAttachments}
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
          "flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-background px-4 py-8 text-center transition-colors hover:border-border hover:bg-muted/30 shadow-sm",
          (ingestBusy || reviewBusy || ws.context_attachments.length >= maxAttachments) &&
            "pointer-events-none opacity-50",
        )}
      >
        {ingestBusy ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5">
            <Upload className="h-6 w-6 text-primary" />
          </div>
        )}
        <p className="mt-4 text-sm font-medium text-foreground">Drop files or click to upload</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          PDF · Word · Markdown/text · max {Math.round(maxFileBytes / (1024 * 1024))} MB each · up to{" "}
          {maxAttachments} files
        </p>
      </button>
      {ingestError ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">{ingestError}</p>
      ) : null}
      {ws.context_attachments.length > 0 ? (
        <ul className="space-y-2">
          {ws.context_attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-border/40 bg-card px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.text.length.toLocaleString()} characters
                  {a.document_id ? (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {" "}
                      · Original file saved to proposal documents
                    </span>
                  ) : null}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 cursor-pointer"
                onClick={() => removeAttachment(a.id)}
                disabled={reviewBusy}
                aria-label={`Remove ${a.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Additional notes (optional)
        </div>
        <Textarea
          value={ws.context_notes}
          onChange={(e) => setWs((w) => ({ ...w, context_notes: e.target.value }))}
          placeholder="Funding, prior IRB numbers, recruitment limits, anything that might contextualize your files…"
          rows={4}
          className="resize-y rounded-md border-border/40 bg-background text-sm"
          disabled={reviewBusy}
        />
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex justify-center sm:justify-start">
          <Button
            type="button"
            disabled={reviewBusy || ws.context_attachments.length === 0}
            onClick={() => requestRunAiReview()}
            size="lg"
            className={cn(
              "h-11 w-full max-w-sm cursor-pointer gap-2 px-7 shadow-sm sm:h-11 sm:w-auto sm:max-w-lg sm:min-w-[14rem]",
              "font-medium tracking-wide",
              "disabled:pointer-events-none disabled:opacity-45",
            )}
          >
            {reviewBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            )}
            <span>{reviewBusy ? "Running review…" : "Run AI review"}</span>
          </Button>
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          Produces protocol review notes, optional consent draft, compliance findings, and revision ideas — without
          rewriting your originals. Use the steps panel or the assistant for details.
        </p>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        // Full-bleed inside the dashboard content area (no "page inside a page").
        "-mx-4 -my-6 md:-mx-8 md:-my-10 lg:-mx-10",
        "relative z-0 flex w-full flex-col bg-background",
        // Chat workspace benefits from a bounded height so it uses the bottom space.
        effectiveVariant !== "upload" &&
          "[height:calc(100dvh-4rem)] md:[height:calc(100dvh-6rem)] min-h-[38rem]"
      )}
    >
      <header className="flex min-h-16 shrink-0 items-start gap-3 bg-background px-4 pb-2 pt-4 md:px-8">
        <Button variant="ghost" size="icon" className="cursor-pointer shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <h1 className="truncate font-semibold text-lg tracking-tight md:text-xl">
              {isRevisionResubmit
                ? "Revise submission"
                : existingProposalId
                  ? effectiveVariant === "upload"
                    ? "Upload & AI review"
                    : "Continue proposal"
                  : effectiveVariant === "upload"
                    ? "Upload & AI review"
                    : "AI protocol draft"}
            </h1>
          </div>
          <p className="sr-only">
            {isRevisionResubmit
              ? "Edit your protocol package with AI assistance, then resubmit to the IRB."
              : existingProposalId
                ? effectiveVariant === "upload"
                  ? "Upload materials, run AI review, complete consent and compliance, then submit."
                  : "Your draft is restored — keep editing, then submit when ready."
                : effectiveVariant === "upload"
                  ? "Upload materials, run AI review, complete consent and compliance, then submit."
                  : "Intake, workspace, consent, review, proposal package — saved as you work"}
            {saving ? " Saving in progress." : ""}
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
          <InputGroup
            className={cn(
              "h-8 min-h-8 w-full min-w-0 rounded-md border-border/60 bg-background text-sm shadow-sm sm:w-52 md:w-[22rem]",
              "has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-ring"
            )}
          >
            <InputGroupAddon
              id="ai-intake-study-title-label"
              align="inline-start"
              className="shrink-0 pl-3 pr-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-foreground"
            >
              Study title
            </InputGroupAddon>
            <InputGroupInput
              id="ai-intake-study-title"
              aria-labelledby="ai-intake-study-title-label"
              aria-required={effectiveVariant === "upload"}
              placeholder="Working title"
              value={suggestedTitle}
              onChange={(e) => setSuggestedTitle(e.target.value)}
              className="min-w-0 pr-3 text-sm"
            />
          </InputGroup>
          <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="default"
                className="h-8 cursor-pointer gap-1.5 shadow-sm"
                disabled={saving || packageUploading || (effectiveVariant === "upload" && !hasStudyTitle)}
                title={
                  effectiveVariant === "upload" && !hasStudyTitle ? "Enter a study title first" : undefined
                }
                onClick={() => void saveDraftAndFiles()}
              >
                {saving || packageUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
              {proposalId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 cursor-pointer"
                  disabled={effectiveVariant === "upload" && !hasStudyTitle}
                  title={
                    effectiveVariant === "upload" && !hasStudyTitle
                      ? "Enter a study title first"
                      : "Download submission record (.pdf)"
                  }
                  onClick={() =>
                    void downloadProposalPackagePdf(
                      packageMarkdown,
                      proposalPackagePdfFilename(proposalId, suggestedTitle.trim() || "Study Protocol"),
                    )
                  }
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
        </div>
      </header>

      <Dialog open={uploadSubmitConfirmOpen} onOpenChange={(open) => {
        setUploadSubmitConfirmOpen(open);
        if (!open) setUploadSubmitConfirmed(false);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm submission</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4 text-sm text-foreground">
            <p className="text-muted-foreground">
              You are about to submit this proposal package to the IRB.
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 cursor-pointer rounded border-border accent-foreground"
                  checked={uploadSubmitConfirmed}
                  onChange={(e) => setUploadSubmitConfirmed(e.target.checked)}
                />
                <span className="leading-relaxed">
                  I confirm I have reviewed the AI review notes, consent draft, and compliance results, and I
                  attest that the information being submitted reflects my work (with AI assistance where used)
                  and is accurate to the best of my knowledge.
                </span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setUploadSubmitConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer gap-2"
              disabled={!uploadSubmitConfirmed || submitting || !canSubmitProposal || !hasStudyTitle}
              onClick={() => {
                setUploadSubmitConfirmOpen(false);
                void submitFinal();
              }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="h-4 w-4" />
              )}
              {isRevisionResubmit ? "Resubmit to IRB" : "Submit to IRB"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={uploadAiReviewConsentDialogOpen}
        onOpenChange={(open) => {
          setUploadAiReviewConsentDialogOpen(open);
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,560px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <div className="min-w-0 px-6 pt-6 pb-2 sm:px-7 sm:pt-7">
            <DialogHeader className="gap-2 space-y-0 text-left">
              <DialogTitle>Include a consent draft?</DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                Should we generate an AI draft consent document as part of this review? Choose{" "}
                <span className="font-medium text-foreground">No</span> if you do not need one — the consent step
                will be marked complete without a generated draft.
              </DialogDescription>
            </DialogHeader>
          </div>
          {/* Outer pad matches header wrapper; inner pr matches DialogHeader so actions line up with body text */}
          <div className="mt-4 min-w-0 border-t border-border px-6 pt-6 pb-6 sm:mt-3 sm:px-7 sm:pb-7">
            <div className="min-w-0 pr-12 sm:pr-14">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-full shrink-0 cursor-pointer sm:mr-auto sm:w-auto"
                  onClick={() => setUploadAiReviewConsentDialogOpen(false)}
                >
                  Cancel
                </Button>
                <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full min-w-0 cursor-pointer whitespace-nowrap px-4 text-center sm:w-auto"
                    onClick={() => {
                      setUploadAiReviewConsentDialogOpen(false);
                      void executeFullAiReview(true);
                    }}
                  >
                    Skip consent
                  </Button>
                  <Button
                    type="button"
                    className="h-10 w-full min-w-0 cursor-pointer whitespace-nowrap px-4 text-center sm:w-auto"
                    onClick={() => {
                      setUploadAiReviewConsentDialogOpen(false);
                      void executeFullAiReview(false);
                    }}
                  >
                    Generate draft
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {effectiveVariant === "upload" && packageS3Error ? (
        <div className="shrink-0 border-b border-amber-500/35 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-950 dark:text-amber-100 md:px-8">
          {packageS3Error}
        </div>
      ) : null}

      {effectiveVariant === "upload" ? (
        <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden bg-background md:min-h-[calc(100dvh-7rem)]">
          <aside className="flex h-full min-h-0 w-[9.25rem] shrink-0 flex-col gap-3 bg-muted/15 px-2 py-3 sm:w-44 sm:px-3 sm:py-4">
            <p className="px-2 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Steps
            </p>
            <nav aria-label="Proposal steps" className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ol className="flex flex-col gap-0">
                {UPLOAD_WIZARD_STEPS.map((step, i) => (
                  <li key={step.label}>
                    <button
                      type="button"
                      disabled={blockWorkspace}
                      onClick={() => goToUploadWizardStep(i)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors sm:gap-2.5",
                        blockWorkspace && "cursor-not-allowed opacity-40",
                        uploadWizardStep === i && "bg-background/95 text-foreground shadow-sm ring-1 ring-border/55",
                        uploadWizardStep !== i &&
                          "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums leading-none",
                          uploadWizardStep > i &&
                            "border-emerald-600/35 bg-emerald-500/[0.12] text-emerald-800 dark:text-emerald-200",
                          uploadWizardStep === i &&
                            "border-primary bg-primary text-primary-foreground shadow-sm",
                          uploadWizardStep < i && "border-border/70 bg-background text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {uploadWizardStep > i ? (
                          <Check className="h-3 w-3" strokeWidth={2.75} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="min-w-0 flex-1 text-[11px] font-medium leading-tight tracking-tight sm:text-xs">
                        <span className="block">{UPLOAD_WIZARD_STRIP_LABELS[i]}</span>
                        {i === 2 && ws.consent_generation_declined ? (
                          <span className="mt-0.5 block text-[0.58rem] font-medium uppercase tracking-wider text-muted-foreground">
                            Skipped
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="shrink-0 pt-1">
              {proposalId && complianceComplete ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 w-full cursor-pointer gap-1.5 px-2 text-[11px] shadow-sm sm:text-xs"
                  disabled={submitting || !canSubmitProposal || !hasStudyTitle}
                  onClick={() => setUploadSubmitConfirmOpen(true)}
                  title={!hasStudyTitle ? "Enter a study title first" : undefined}
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{isRevisionResubmit ? "Resubmit" : "Submit to IRB"}</span>
                </Button>
              ) : null}
            </div>
          </aside>

          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <div className="relative mx-auto max-w-3xl px-4 py-10 pb-28 md:max-w-4xl md:px-8 md:py-14 lg:max-w-5xl">
              {blockWorkspace ? (
                <div
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/65 px-6 py-10 text-center backdrop-blur-[1px]"
                  role="region"
                  aria-live="polite"
                  aria-label="Study title required"
                >
                  <p className="max-w-sm text-sm font-medium text-foreground">
                    Enter a study title in the header to use this workspace.
                  </p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Use the back arrow to leave without saving.
                  </p>
                </div>
              ) : null}

              {uploadWizardStep === 0 ? uploadMaterialsWizardSection : null}
              {uploadWizardStep === 1 ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Step 2 · AI review
                    </p>
                    <h2 className="font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
                      AI review notes
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Structured observations from your uploaded materials.
                    </p>
                  </div>
                  {uploadAiReviewSection}
                </div>
              ) : null}
              {uploadWizardStep === 2 ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Step 3 · Consent
                    </p>
                    <h2 className="font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
                      Consent draft
                    </h2>
                  </div>
                  {ws.consent_generation_declined ? (
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-5 py-6 text-sm leading-relaxed text-muted-foreground">
                      <p className="font-medium text-foreground">Consent draft not generated</p>
                      <p className="mt-2">
                        You chose not to include an AI-generated consent document. This step is marked complete
                        for your workflow.
                      </p>
                      <p className="mt-4 text-xs">
                        Run <strong className="text-foreground">AI review</strong> again from Materials if you
                        want a consent draft generated later.
                      </p>
                    </div>
                  ) : (
                    consentDraftSection
                  )}
                </div>
              ) : null}
              {uploadWizardStep === 3 ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Step 4 · Compliance
                    </p>
                    <h2 className="font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
                      Compliance & revisions
                    </h2>
                  </div>
                  {complianceReviewSection}
                </div>
              ) : null}
              {uploadWizardStep === 4 ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Step 5 · Extra materials
                    </p>
                    <h2 className="font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
                      Extra materials
                    </h2>
                  </div>
                  {extraMaterialsSection}
                </div>
              ) : null}
              {uploadWizardStep === 5 ? (
                <div className="space-y-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Step 6 · Submit
                  </p>
                  <h2 className="font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
                    Submit to the IRB
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    When compliance is complete and you have reviewed AI outputs, use{" "}
                    <strong className="font-medium text-foreground">Submit to IRB</strong> in the left sidebar
                    (same control as elsewhere on this flow). Your draft still saves automatically as you work. The
                    final submission includes this protocol document, your optional consent form (when included), and
                    any extra materials you attached.
                  </p>
                  <div className="mt-8 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Proposal package
                        </p>
                        <p className="text-[0.7rem] text-muted-foreground">
                          Review before submitting. You can optionally edit directly on the document.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 cursor-pointer text-xs"
                        onClick={() => setPackageViewMode((m) => (m === "source" ? "preview" : "source"))}
                      >
                        {packageViewMode === "source" ? "Done" : "Edit"}
                      </Button>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/60 p-2 md:p-3">
                      {packageViewMode === "preview" ? (
                        <ProposalMarkdownPreview markdown={packageDraftMarkdown || packageMarkdown} />
                      ) : (
                        <ProposalCanvasEditor
                          markdown={packageDraftMarkdown || packageMarkdown}
                          onMarkdownChange={(md) => {
                            setPackageDraftDirty(true);
                            setPackageDraftMarkdown(md);
                          }}
                        />
                      )}
                    </div>
                    {packageDraftDirty ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 cursor-pointer text-xs"
                          onClick={() => {
                            setPackageDraftDirty(false);
                            setPackageDraftMarkdown(packageMarkdown);
                          }}
                        >
                          Reset to generated
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-8">
                <Button
                  type="button"
                  variant="ghost"
                  className="cursor-pointer"
                  disabled={uploadWizardStep <= 0 || blockWorkspace}
                  onClick={() => goToUploadWizardStep(uploadWizardStep - 1)}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={uploadWizardStep >= 5 || blockWorkspace}
                  onClick={() => goToUploadWizardStep(uploadWizardStep + 1)}
                >
                  Continue
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden bg-background md:min-h-[calc(100dvh-7rem)]">
          <aside className="flex h-full min-h-0 w-[9.25rem] shrink-0 flex-col gap-3 bg-muted/15 px-2 py-3 sm:w-52 sm:px-3 sm:py-4">
            <p className="px-2 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Steps
            </p>
            <nav aria-label="Draft with AI steps" className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ol className="flex flex-col gap-0">
                {(
                  [
                    "Materials",
                    "AI intake",
                    "Consent?",
                    "Consent",
                    "Proposal",
                    "Compliance",
                    "Extra materials",
                    "Submit",
                  ] as const
                ).map((label, i) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => goToDraftWizardStep(i)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors sm:gap-2.5",
                        draftWizardStep === i && "bg-background/95 text-foreground shadow-sm ring-1 ring-border/55",
                        draftWizardStep !== i && "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums leading-none",
                          draftWizardStep > i &&
                            "border-emerald-600/35 bg-emerald-500/[0.12] text-emerald-800 dark:text-emerald-200",
                          draftWizardStep === i &&
                            "border-primary bg-primary text-primary-foreground shadow-sm",
                          draftWizardStep < i && "border-border/70 bg-background text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {draftWizardStep > i ? <Check className="h-3 w-3" strokeWidth={2.75} /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-[11px] font-medium leading-tight tracking-tight sm:text-xs">
                        <span className="block">{label}</span>
                        {i === 3 && ws.consent_generation_declined ? (
                          <span className="mt-0.5 block text-[0.58rem] font-medium uppercase tracking-wider text-muted-foreground">
                            Skipped
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            {draftWizardStep === 1 ? (
              <div className="flex h-full min-h-0 flex-col bg-background">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/40 px-6 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Step 2 · AI intake
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Chat until you feel the AI has enough detail. Then continue.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => goToDraftWizardStep(2)}
                    disabled={
                      aiBusy ||
                      (ws.messages.length === 0 &&
                        ws.context_attachments.length === 0 &&
                        !ws.context_notes.trim())
                    }
                    title={
                      ws.messages.length === 0 &&
                      ws.context_attachments.length === 0 &&
                      !ws.context_notes.trim()
                        ? "Add files, notes, or a message before continuing"
                        : undefined
                    }
                  >
                    Continue
                  </Button>
                </div>

                <div
                  ref={chatScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 lg:p-8 [-webkit-overflow-scrolling:touch]"
                >
                  <div ref={chatContentRef} className="mx-auto w-full max-w-4xl space-y-4">
                    {ws.messages.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-sm leading-relaxed text-muted-foreground">
                        Start by describing your study (aim, population, procedures, data, risks, recruitment). If you
                        don’t have materials yet, that’s fine — just continue in chat.
                      </p>
                    ) : null}
                    <AnimatePresence initial={false}>
                      {ws.messages.map((m, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "max-w-[95%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                            m.role === "user"
                              ? "ml-auto bg-foreground/90 text-background"
                              : "mr-auto border border-border/40 bg-card text-foreground shadow-sm",
                          )}
                        >
                          {m.content}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="shrink-0 border-t border-border/60 bg-background p-4 lg:p-6">
                  <div className="mx-auto w-full max-w-4xl">
                    <div className="flex gap-2">
                      <Textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask or answer…"
                        disabled={aiBusy}
                        rows={1}
                        className="min-h-11 max-h-32 flex-1 resize-none overflow-auto rounded-md border-border/40 bg-background text-sm leading-relaxed shadow-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            void sendChat();
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        className="h-11 w-11 shrink-0 cursor-pointer rounded-md shadow-sm"
                        disabled={aiBusy}
                        onClick={() => void sendChat()}
                        aria-label="Send"
                      >
                        {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="mt-2 text-[0.7rem] text-muted-foreground">
                      Press <span className="font-medium text-foreground">⌘ Enter</span> (or{" "}
                      <span className="font-medium text-foreground">Ctrl Enter</span>) to send.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col bg-muted/10">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/40 px-6 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {draftWizardStep === 0
                        ? "Step 1 · Materials"
                        : draftWizardStep === 2
                          ? "Step 3 · Consent?"
                          : draftWizardStep === 3
                            ? "Step 4 · Consent"
                            : draftWizardStep === 4
                              ? "Step 5 · Proposal"
                              : draftWizardStep === 5
                                ? "Step 6 · Compliance"
                                : draftWizardStep === 6
                                  ? "Step 7 · Extra materials"
                                  : "Step 8 · Submit"}
                    </p>
                  </div>
                  {proposalId && complianceComplete ? (
                    <Button
                      type="button"
                      className="h-9 cursor-pointer gap-2 shadow-sm"
                      disabled={submitting || !canSubmitProposal || draftWizardStep !== 7}
                      onClick={() => setUploadSubmitConfirmOpen(true)}
                      title={draftWizardStep !== 7 ? "Go to Submit step first" : undefined}
                    >
                      <Check className="h-4 w-4" />
                      {isRevisionResubmit ? "Resubmit to IRB" : "Submit to IRB"}
                    </Button>
                  ) : null}
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div
                    className={cn(
                      "w-full",
                      rightTab === "consent" || rightTab === "package"
                        ? "flex min-h-[calc(100dvh-9rem)] flex-col gap-3 p-4 md:p-6"
                        : "space-y-8 p-4 md:p-6 lg:p-8",
                    )}
                  >
                    {draftWizardStep === 2 ? (
                      <div className="mx-auto w-full max-w-2xl space-y-6">
                        <h2 className="font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
                          Do you need a consent draft?
                        </h2>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Choose <strong className="font-medium text-foreground">Skip consent</strong> if this study
                          does not require a participant consent document. We’ll mark the consent step as not needed.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 cursor-pointer"
                            onClick={() => {
                              setWs((w) => ({ ...w, consent_generation_declined: true }));
                              goToDraftWizardStep(4);
                            }}
                          >
                            Skip consent
                          </Button>
                          <Button
                            type="button"
                            className="h-10 cursor-pointer"
                            onClick={() => {
                              setWs((w) => ({ ...w, consent_generation_declined: false }));
                              void runConsent();
                              goToDraftWizardStep(3);
                            }}
                          >
                            Generate consent draft
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {draftWizardStep === 0 && rightTab === "context" ? (
                      <div className="space-y-6">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          Upload materials and add any notes that should be treated as ground truth. If you’re
                          starting from scratch, you can continue to the AI intake step without uploads.
                        </p>
                        {/* existing context UI */}
                        {rightTab === "context" ? (
                          <div className="space-y-6">
                            <div>
                              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                                disabled={ingestBusy || ws.context_attachments.length >= maxAttachments}
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
                                  "flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/60 bg-background px-4 py-8 text-center transition-colors hover:border-border hover:bg-muted/30 shadow-sm",
                                  (ingestBusy || ws.context_attachments.length >= maxAttachments) &&
                                    "pointer-events-none opacity-50",
                                )}
                              >
                                {ingestBusy ? (
                                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5">
                                    <Upload className="h-6 w-6 text-primary" />
                                  </div>
                                )}
                                <p className="mt-4 text-sm font-medium text-foreground">
                                  Drop files here or click to upload
                                </p>
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                  PDF or plain text · up to {Math.round(maxFileBytes / (1024 * 1024))} MB each · max{" "}
                                  {maxAttachments} files · text is used as AI context and saved with your draft
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
                                          {a.document_id ? (
                                            <span className="text-emerald-700 dark:text-emerald-400">
                                              {" "}
                                              · Original file saved to proposal documents
                                            </span>
                                          ) : null}
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

                            <div>
                              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <StickyNote className="h-3.5 w-3.5" />
                                Notes for the AI
                              </div>
                              <Textarea
                                value={ws.context_notes}
                                onChange={(e) => setWs((w) => ({ ...w, context_notes: e.target.value }))}
                                placeholder="Grant boilerplate, prior IRB stipulations, lab SOPs, recruitment copy, anything Gemini should treat as ground truth alongside the chat…"
                                rows={6}
                                className="min-h-[120px] resize-y rounded-md border-border/60 bg-background text-sm leading-relaxed shadow-sm"
                              />
                              <p className="mt-2 text-[0.75rem] text-muted-foreground leading-relaxed">
                                Notes and uploads are included on every AI call (intake, consent, compliance).
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {draftWizardStep !== 2 && rightTab === "consent" ? (
                      ws.consent_generation_declined ? (
                        <p className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground">
                          Consent marked as not needed.
                        </p>
                      ) : (
                        consentDraftSection
                      )
                    ) : null}

                    {draftWizardStep === 5 && rightTab === "compliance" ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              AI review
                            </p>
                            <p className="text-[0.7rem] text-muted-foreground">
                              Run compliance checks and generate revision suggestions.
                            </p>
                          </div>
                          <Button
                            type="button"
                            className="h-9 cursor-pointer gap-2 shadow-sm"
                            disabled={reviewBusy || complianceBusy}
                            onClick={() => void runDraftAiReview()}
                          >
                            {reviewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Run AI review
                          </Button>
                        </div>
                        {complianceReviewSection}
                      </div>
                    ) : null}
                    {draftWizardStep !== 2 && rightTab === "package" ? (
                      <div className="flex min-h-0 flex-1 flex-col gap-3">
                        {!proposalId ? (
                          <p className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                            Finish saving a draft before downloading or uploading the package.
                          </p>
                        ) : null}
                        {packageS3Error ? (
                          <p className="shrink-0 text-xs text-amber-800 dark:text-amber-200">{packageS3Error}</p>
                        ) : null}
                        <div
                          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent"
                          role="region"
                          aria-label="Proposal package for submission"
                        >
                          <div
                            className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-0 py-1"
                            role="toolbar"
                            aria-label="Preview or edit proposal package"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="inline-flex rounded-md bg-muted/30 p-0.5">
                              <button
                                type="button"
                                onClick={() => setPackageViewMode("preview")}
                                className={cn(
                                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                                  packageViewMode === "preview"
                                    ? "bg-background text-foreground"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                Preview
                              </button>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 cursor-pointer text-xs"
                                onClick={() => setPackageViewMode((m) => (m === "source" ? "preview" : "source"))}
                              >
                                {packageViewMode === "source" ? "Done" : "Edit"}
                              </Button>
                              {packageDraftDirty ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 cursor-pointer text-xs"
                                  onClick={() => {
                                    setPackageDraftDirty(false);
                                    setPackageDraftMarkdown(packageMarkdown);
                                  }}
                                >
                                  Reset to generated
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <div className="min-h-0 flex-1 overflow-auto px-0 py-3">
                            {packageViewMode === "preview" ? (
                              <ProposalMarkdownPreview markdown={packageDraftMarkdown || packageMarkdown} />
                            ) : (
                              <ProposalCanvasEditor
                                markdown={packageDraftMarkdown || packageMarkdown}
                                onMarkdownChange={(md) => {
                                  setPackageDraftDirty(true);
                                  setPackageDraftMarkdown(md);
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {draftWizardStep === 6 ? (
                      <div className="mx-auto w-full max-w-3xl space-y-6">
                        <div className="space-y-2">
                          <h2 className="font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
                            Extra materials
                          </h2>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            Upload any additional documents you want submitted alongside your package and consent.
                          </p>
                        </div>
                        {extraMaterialsSection}
                      </div>
                    ) : null}

                    {draftWizardStep === 7 ? (
                      <div className="space-y-4">
                        <h2 className="font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
                          Submit to the IRB
                        </h2>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          When compliance is complete and you’ve reviewed the proposal package, submit using the button
                          in the header. Submission includes the finalized protocol, optional consent form (if
                          included), and any extra materials attached in the previous step.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-6">
                      <Button
                        type="button"
                        variant="ghost"
                        className="cursor-pointer"
                        disabled={draftWizardStep <= 0}
                        onClick={() => goToDraftWizardStep(draftWizardStep - 1)}
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        disabled={
                          draftWizardStep >= 7 ||
                          draftWizardStep === 2 ||
                          (draftWizardStep === 1 &&
                            (aiBusy ||
                              (ws.messages.length === 0 &&
                                ws.context_attachments.length === 0 &&
                                !ws.context_notes.trim())))
                        }
                        onClick={() => goToDraftWizardStep(draftWizardStep + 1)}
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      )}

      {effectiveVariant === "upload" && !blockWorkspace ? (
        <>
          <AnimatePresence>
            {uploadChatOpen ? (
              <motion.div
                key="upload-assistant-panel"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="fixed bottom-20 right-4 z-50 flex max-h-[min(520px,calc(100dvh-6rem))] w-[min(calc(100vw-2rem),380px)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl ring-1 ring-black/5 md:bottom-8 md:right-8"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-gradient-to-r from-teal-500/10 via-background to-violet-500/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Proposal assistant</p>
                    <p className="text-[0.65rem] text-muted-foreground">
                      Compliance, consent, and revisions in context
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer"
                    onClick={() => setUploadChatOpen(false)}
                    aria-label="Close assistant"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div
                  ref={uploadChatScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
                >
                  <div ref={uploadChatContentRef} className="space-y-3">
                  {uploadChatMessages.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
                      Ask about compliance flags, the consent draft, or the AI review notes — grounded in your
                      uploaded materials.
                    </p>
                  ) : null}
                  {uploadChatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "max-w-[95%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                        m.role === "user"
                          ? "ml-auto bg-foreground/30 text-background"
                          : "mr-auto border border-border/60 bg-card text-foreground shadow-sm",
                      )}
                    >
                      {m.role === "assistant" ? (
                        <ProposalMarkdownPreview markdown={m.content} />
                      ) : (
                        m.content
                      )}
                    </div>
                  ))}
                  {uploadChatBusy ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Thinking…
                    </div>
                  ) : null}
                  </div>
                </div>
                <div className="shrink-0 border-t border-border/60 bg-muted/10 p-3">
                  <div className="flex gap-2">
                    <Input
                      value={uploadChatInput}
                      onChange={(e) => setUploadChatInput(e.target.value)}
                      placeholder="Message…"
                      disabled={uploadChatBusy}
                      className="h-10 flex-1 rounded-md border-border/60 bg-background text-sm shadow-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendUploadAssistantMessage();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-10 w-10 shrink-0 cursor-pointer rounded-md shadow-sm"
                      disabled={uploadChatBusy || !uploadChatInput.trim()}
                      onClick={() => void sendUploadAssistantMessage()}
                      aria-label="Send"
                    >
                      {uploadChatBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-[0.65rem] leading-relaxed text-muted-foreground">
                    Informational only — not legal advice. Uses your uploads and current review state.
                  </p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {!uploadChatOpen ? (
            <motion.button
              type="button"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={cn(
                "fixed bottom-20 right-4 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full",
                "bg-primary text-primary-foreground shadow-xl",
                "ring-2 ring-primary/35 hover:ring-primary/55",
                "transition-[transform,box-shadow,ring-color] hover:shadow-2xl active:scale-[0.98]",
                "md:bottom-8 md:right-8",
              )}
              onClick={() => setUploadChatOpen(true)}
              aria-label="Open proposal assistant"
            >
              <MessageCircle className="h-6 w-6" />
            </motion.button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
