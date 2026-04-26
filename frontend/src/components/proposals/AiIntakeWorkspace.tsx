"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  FileCheck2,
  FileDown,
  FileText,
  Library,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Send,
  ShieldCheck,
  StickyNote,
  Upload,
  Wand2,
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { db } from "@/lib/database";
import type { ProposalStatus } from "@/lib/types";
import { supplementaryFromWorkspace } from "@/lib/ai-context";
import {
  emptyAiWorkspace,
  normalizeAiWorkspace,
  protocolHasReviewContent,
  PROTOCOL_SECTION_KEYS,
  PROTOCOL_SECTION_LABELS,
  type AiChatMessage,
  type AiWorkspaceState,
  type ProtocolSectionKey,
} from "@/lib/ai-proposal-types";
import { buildFormDataFromAiWorkspace } from "@/lib/ai-proposal-merge";
import {
  buildProposalPackageMarkdown,
  proposalPackageFilename,
  downloadProposalPackagePdf,
  proposalPackagePdfFilename,
  buildProposalPackagePdfBytes,
} from "@/lib/ai-proposal-package-markdown";
import {
  MAX_INGEST_BYTES_PER_FILE,
  MAX_UPLOAD_ATTACHMENTS_CHAT,
  MAX_UPLOAD_ATTACHMENTS_MATERIALS,
} from "@/lib/ai-upload-limits";

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

  const packageMarkdown = useMemo(
    () => buildProposalPackageMarkdown(ws, suggestedTitle),
    [ws, suggestedTitle],
  );

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

  /** Saves workspace to the database and uploads the Markdown record to proposal file storage. */
  async function saveDraftAndFiles() {
    if (effectiveVariant === "upload" && !suggestedTitle.trim()) return;
    setPackageS3Error(null);
    const id = await persist(ws, suggestedTitle);
    if (!id) return;
    setPackageUploading(true);
    try {
      const md = buildProposalPackageMarkdown(ws, suggestedTitle);
      const file = new File([md], proposalPackageFilename(id), {
        type: "text/markdown",
      });
      await db.presignUploadProposalFile(id, file);
      const { workspace: wsSynced, uploaded } = await syncOriginalAttachmentsToStorage(id, ws);
      if (uploaded > 0) {
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
    setRightTab(effectiveVariant === "upload" ? "compliance" : "package");
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
      setRightTab("context");
    }
  }, [effectiveVariant, rightTab]);

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

  async function runFullAiReview() {
    if (!suggestedTitle.trim()) return;
    if (ws.context_attachments.length === 0) {
      setIngestError("Add at least one PDF or text file.");
      return;
    }
    setReviewBusy(true);
    setIngestError(null);
    setRevisionSuggestions([]);
    setRightTab("compliance");
    try {
      const combined = ws.context_attachments.map((a) => `## ${a.name}\n${a.text}`).join("\n\n");
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

      let next: AiWorkspaceState = {
        ...ws,
        protocol: synData.protocol ?? ws.protocol,
      };
      setWs(next);

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
        compliance_flags: compData.flags ?? [],
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
      setRightTab("consent");
      return;
    }
    setRightTab("context");
  }

  async function submitFinal() {
    if (effectiveVariant === "upload" && !suggestedTitle.trim()) return;
    if (!proposalId) return;
    const submitMode = loadedProposalStatus ?? "draft";
    if (!complianceComplete) {
      setRightTab("compliance");
      return;
    }
    setSubmitting(true);
    setPackageS3Error(null);
    try {
      const { workspace: wsSynced } = await syncOriginalAttachmentsToStorage(proposalId, ws);
      if (wsSynced !== ws) {
        setWs(wsSynced);
      }
      const merged = buildFormDataFromAiWorkspace(
        { ...wsSynced, phase: "submit" },
        suggestedTitle,
        { entryMode: effectiveVariant === "upload" ? "upload_review" : "ai_draft" },
      );
      const title = suggestedTitle.trim() || "Draft study";
      const md = buildProposalPackageMarkdown({ ...wsSynced, phase: "submit" }, suggestedTitle);
      const pdfName = proposalPackagePdfFilename(proposalId);
      await db.updateProposal(proposalId, {
        title,
        review_type: wsSynced.predicted_category ?? undefined,
        form_data: {
          ...merged,
          submission_snapshot: {
            markdown: md,
            file_name: proposalPackageFilename(proposalId),
            pdf_file_name: pdfName,
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
        focusSubmissionIssue();
        return;
      }

      // Upload PDF package (client-generated) alongside Markdown/Word.
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
          body: JSON.stringify({ markdown: md }),
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
            state). Open the proposal, download your submitted Markdown or Word file from the Documents
            tab, edit locally, then contact your IRB office if you need to replace files on record.
          </p>
        </div>
      </div>
    );
  }

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
                      proposalPackagePdfFilename(proposalId),
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

      {effectiveVariant === "upload" && packageS3Error ? (
        <div className="shrink-0 border-b border-amber-500/35 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-950 dark:text-amber-100 md:px-8">
          {packageS3Error}
        </div>
      ) : null}

      <div
        className={cn(
          "relative grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-2",
          leftPaneCollapsed && "md:grid-cols-1",
        )}
      >
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
        {!leftPaneCollapsed && (
          effectiveVariant === "upload" ? (
          <div className="flex flex-col border-b border-border/40 bg-background md:border-b-0 md:border-r">
            <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-6 py-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Your materials
              </span>
              <div className="flex items-center gap-2">
                {reviewBusy ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    AI review…
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 cursor-pointer"
                  onClick={() => setLeftPaneCollapsed(true)}
                  aria-label="Collapse materials panel"
                  aria-expanded={!leftPaneCollapsed}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-6 lg:p-8">
              <div className="mx-auto w-full max-w-[120rem] space-y-6">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload <strong className="text-foreground">PDF, Word (.docx), or Markdown/text</strong> — up
                  to {Math.round(maxFileBytes / (1024 * 1024))} MB per file, {maxAttachments} files max. The AI
                  reviews your materials and surfaces observations, consent drafts, and compliance notes{" "}
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
                  disabled={
                    ingestBusy || reviewBusy || ws.context_attachments.length >= maxAttachments
                  }
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
                <Button
                  type="button"
                  className="w-full cursor-pointer rounded-md shadow-sm"
                  disabled={reviewBusy || ws.context_attachments.length === 0}
                  onClick={() => void runFullAiReview()}
                >
                  {reviewBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Run AI review
                </Button>
                <p className="text-[0.7rem] text-muted-foreground">
                  Produces section-by-section review notes, a consent draft, compliance flags, and revision
                  ideas — without rewriting your files. Use the tabs on the right to explore each part or open
                  the assistant.
                </p>
                <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer rounded-md text-xs shadow-sm"
                    disabled={reviewBusy || consentBusy}
                    onClick={() => void runConsent()}
                  >
                    Consent only
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer rounded-md text-xs shadow-sm"
                    disabled={reviewBusy || complianceBusy}
                    onClick={() => void runCompliance()}
                  >
                    Compliance only
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[36vh] flex-col border-b border-border/60 bg-background md:min-h-0 md:border-b-0 md:border-r">
            <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-6 py-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Conversational intake
              </span>
              <div className="flex items-center gap-2">
                {aiBusy ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Bot className="h-3.5 w-3.5 animate-pulse" aria-hidden />
                    AI composing…
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 cursor-pointer"
                  onClick={() => setLeftPaneCollapsed(true)}
                  aria-label="Collapse intake panel"
                  aria-expanded={!leftPaneCollapsed}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div
              ref={chatScrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 lg:p-8 [-webkit-overflow-scrolling:touch]"
            >
              <div ref={chatContentRef} className="mx-auto w-full max-w-[120rem] space-y-4">
                <AnimatePresence initial={false}>
                  {ws.messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "max-w-[95%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                        m.role === "user"
                          ? "ml-auto bg-foreground text-background"
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
              <div className="mx-auto w-full max-w-[120rem]">
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Answer or ask a question…"
                    disabled={aiBusy}
                    className="h-11 flex-1 rounded-md border-border/40 shadow-sm"
                    onKeyDown={(e) =>
                      e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void sendChat())
                    }
                  />
                  <Button
                    size="icon"
                    className="h-11 w-11 shrink-0 cursor-pointer rounded-md shadow-sm"
                    disabled={aiBusy}
                    onClick={() => void sendChat()}
                  >
                    {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer rounded-md border-border/40 text-xs shadow-sm"
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
                    className="cursor-pointer rounded-md border-border/40 text-xs shadow-sm"
                    disabled={complianceBusy}
                    onClick={() => void runCompliance()}
                  >
                    <Scale className="mr-1.5 h-3.5 w-3.5" />
                    Run compliance check
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Context + outputs */}
        <div className="flex h-full min-h-[36vh] flex-col bg-muted/10 md:min-h-0">
          <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {leftPaneCollapsed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 cursor-pointer rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  onClick={() => setLeftPaneCollapsed(false)}
                  aria-label="Show materials panel"
                  aria-expanded={!leftPaneCollapsed}
                >
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                  <span className="sr-only">Materials</span>
                </Button>
              ) : null}
              <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-lg border border-border/40 bg-muted/30 p-1">
                {(
                  effectiveVariant === "upload"
                    ? (
                        [
                          ["context", "AI review", Library],
                          ["consent", "Consent", ShieldCheck],
                          ["compliance", "Compliance", Scale],
                        ] as const
                      )
                    : (
                        [
                          ["context", "Workspace", Library],
                          ["consent", "Consent", ShieldCheck],
                          ["compliance", "Compliance", Scale],
                          ["package", "Proposal", FileDown],
                        ] as const
                      )
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    disabled={blockWorkspace}
                    onClick={() => setRightTab(key)}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      rightTab === key
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                        : "text-muted-foreground hover:text-foreground",
                      blockWorkspace && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {proposalId && complianceComplete ? (
                <Button
                  type="button"
                  size="default"
                  className="hidden h-8 cursor-pointer gap-2 shadow-sm sm:inline-flex"
                  disabled={
                    submitting ||
                    !canSubmitProposal ||
                    (effectiveVariant === "upload" && !hasStudyTitle) ||
                    (effectiveVariant !== "upload" && rightTab !== "package")
                  }
                  onClick={() => setUploadSubmitConfirmOpen(true)}
                  title={
                    effectiveVariant === "upload" && !hasStudyTitle
                      ? "Enter a study title first"
                      : effectiveVariant !== "upload" && rightTab !== "package"
                        ? "Review the proposal package first"
                        : undefined
                  }
                >
                  <Check className="h-4 w-4" />
                  {isRevisionResubmit ? "Resubmit to IRB" : "Submit to IRB"}
                </Button>
              ) : null}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div
              className={cn(
                // Let the right pane fully use its width (no centering "max-width" container).
                "w-full",
                rightTab === "consent" ||
                (rightTab === "package" && effectiveVariant !== "upload")
                  ? "flex min-h-[calc(100dvh-9rem)] flex-col gap-3 p-4 md:p-6"
                  : "space-y-8 p-4 md:p-6 lg:p-8",
              )}
            >
              {rightTab === "context" ? (
                effectiveVariant === "upload" ? (
                  <div className="space-y-4">

                    {protocolHasReviewContent(ws.protocol) ? (
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
                                  <p className="text-sm font-semibold text-foreground">
                                    {PROTOCOL_SECTION_LABELS[k]}
                                  </p>
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
                        Run <strong className="text-foreground">AI review</strong> on the left after uploading
                        files. Notes will appear here.
                      </p>
                    )}
                  </div>
                ) : (
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
                      Notes and uploads are included on every AI call (intake, consent, compliance). There is no
                      separate on-screen “protocol snapshot”—the model keeps structured fields internally; if it
                      asks you to confirm something, answer here or add detail in notes.
                    </p>
                  </div>
                </div>
                )
              ) : null}

              {rightTab === "consent" ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  {consentBusy ? (
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      Generating consent…
                    </div>
                  ) : null}
                  <div
                    className="flex min-h-0 flex-1 flex-col px-6 md:px-8 lg:px-10"
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
                        onClick={() =>
                          setConsentViewMode((m) => (m === "source" ? "preview" : "source"))
                        }
                      >
                        {consentViewMode === "source" ? "Done" : "Edit"}
                      </Button>
                    </div>

                    <div className="mt-1 min-h-0 flex-1 px-0">
                      {consentViewMode === "source" ? (
                        <Textarea
                          value={ws.consent_markdown ?? ""}
                          onChange={(e) => setWs((w) => ({ ...w, consent_markdown: e.target.value }))}
                          className="box-border min-h-[calc(100dvh-15rem)] w-full resize-y rounded-md border-border/60 bg-background font-mono text-sm leading-relaxed shadow-sm"
                          placeholder="Consent form will appear here…"
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
              ) : null}

              {rightTab === "compliance" ? (
                <div className="space-y-8">
                  {complianceBusy || reviewBusy ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {reviewBusy
                        ? "Running review…"
                        : "Analyzing against 45 CFR 46 heuristics…"}
                    </div>
                  ) : null}
                  {ws.compliance_flags.length === 0 && !complianceBusy && !reviewBusy ? (
                    <p className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground">
                      No compliance items yet. Run <strong className="text-foreground">AI review</strong> (or
                      “Compliance only”) to generate checks.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {effectiveVariant === "upload" && revisionSuggestions.length > 0 ? (
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
                            if (a.section_key !== b.section_key) return String(a.section_key).localeCompare(String(b.section_key));
                            return a.message.localeCompare(b.message);
                          })
                          .map((f) => {
                            const preview = (f.actionable ?? f.cfr_reference ?? "").trim();
                            const previewLine =
                              preview.length > 140 ? `${preview.slice(0, 140)}…` : preview;
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
                                    {previewLine ? (
                                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                        {previewLine}
                                      </p>
                                    ) : null}
                                  </div>
                                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="mt-3 pt-3">
                                  {f.cfr_reference ? (
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-semibold text-foreground">Reference:</span> {f.cfr_reference}
                                    </p>
                                  ) : null}
                                  {f.actionable ? (
                                    <p className={cn("mt-2 text-sm text-foreground", !f.cfr_reference && "mt-0")}>
                                      <span className="font-semibold">Suggested fix:</span> {f.actionable}
                                    </p>
                                  ) : null}
                                  {f.section_key !== "general" ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="mt-3 cursor-pointer"
                                      onClick={() =>
                                        scrollToSection(f.section_key as ProtocolSectionKey | "consent")
                                      }
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
              ) : null}

              {rightTab === "package" && effectiveVariant !== "upload" ? (
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
                      aria-label="Preview or view Markdown source"
                    >
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
                        <button
                          type="button"
                          onClick={() => setPackageViewMode("source")}
                          className={cn(
                            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                            packageViewMode === "source"
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          Markdown
                        </button>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto px-0 py-3">
                      {packageViewMode === "preview" ? (
                        <ProposalMarkdownPreview markdown={packageMarkdown} />
                      ) : (
                        <pre className="whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-relaxed text-foreground">
                          {packageMarkdown}
                        </pre>
                      )}
                    </div>
                  </div>

                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </div>

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
                          ? "ml-auto bg-foreground text-background"
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
