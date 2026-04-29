"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  MessageSquare,
  Send,
  Download,
  Loader2,
  ScrollText,
  PencilLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { dashboardCardClass, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { TreeView } from "@/components/ui/tree-view";
import { MessagesThread } from "@/components/messages/MessagesThread";
import { ProposalMarkdownPreview } from "@/components/proposals/ProposalMarkdownPreview";
import { db } from "@/lib/database";
import { getSubmissionSnapshot } from "@/lib/submission-snapshot";
import type { ProposalDetail, Message, Letter } from "@/lib/types";
import { cn } from "@/lib/utils";

const HIDDEN_FORM_SECTIONS = new Set(["ai_workspace", "submission_snapshot", "entry_mode"]);

const PI_TABS = ["details", "documents", "letters", "messages"] as const;
type PiTab = (typeof PI_TABS)[number];

function markdownToPlainText(input: string): string {
  if (!input) return "";
  return input
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*\d+\.\s+/gm, "• ")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .trim();
}

function extractAiCallouts(text: string): { body: string; gaps?: string; suggested?: string } | null {
  const t = (text ?? "").trim();
  if (!t) return null;

  const gapsRe = /(?:^|\s)(?:Gaps\/Ambiguities|Gaps|Ambiguities)\s*:\s*/i;
  const suggestedRe = /(?:^|\s)Suggested\s+Revisions?\s*:\s*/i;

  if (!gapsRe.test(t) && !suggestedRe.test(t)) return null;

  // Split preserving order without relying on exact capitalization.
  let body = t;
  let gaps: string | undefined;
  let suggested: string | undefined;

  const suggestedMatch = body.match(suggestedRe);
  if (suggestedMatch?.index != null) {
    const idx = suggestedMatch.index;
    const before = body.slice(0, idx).trim();
    const after = body.slice(idx).replace(suggestedRe, "").trim();
    body = before;
    suggested = after || undefined;
  }

  const gapsMatch = body.match(gapsRe);
  if (gapsMatch?.index != null) {
    const idx = gapsMatch.index;
    const before = body.slice(0, idx).trim();
    const after = body.slice(idx).replace(gapsRe, "").trim();
    body = before;
    gaps = after || undefined;
  }

  // In case the order was gaps then suggested, re-extract suggested from gaps block.
  if (gaps && suggestedRe.test(gaps) && !suggested) {
    const parts = gaps.split(suggestedRe);
    gaps = parts[0].trim() || undefined;
    suggested = (parts.slice(1).join(" ").trim()) || undefined;
  }

  return { body, gaps, suggested };
}

function renderJsonValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    const plain = markdownToPlainText(value);
    const callouts = extractAiCallouts(plain);
    if (!callouts) return plain;
    return (
      <div className="space-y-2">
        {callouts.body ? <p className="text-muted-foreground">{callouts.body}</p> : null}
        {callouts.gaps ? (
          <div className="rounded-md bg-muted/25 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Gaps / ambiguities
            </div>
            <div className="mt-1 text-sm text-foreground">{callouts.gaps}</div>
          </div>
        ) : null}
        {callouts.suggested ? (
          <div className="rounded-md bg-muted/25 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested revisions
            </div>
            <div className="mt-1 text-sm text-foreground">{callouts.suggested}</div>
          </div>
        ) : null}
      </div>
    );
  }
  if (typeof value === "number") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return (
      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
        {value.map((item, i) => (
          <li key={i}>{renderJsonValue(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="mt-1 max-h-[min(24rem,50vh)] overflow-auto rounded-lg border border-border/50 bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return String(value);
}

function renderFormSectionBody(sectionKey: string, data: unknown): ReactNode {
  if (data === null || data === undefined) return null;

  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return <div className="text-sm leading-relaxed text-muted-foreground">{renderJsonValue(data)}</div>;
  }

  if (Array.isArray(data)) {
    return <div className="text-sm">{renderJsonValue(data)}</div>;
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>).filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    );

    if (entries.length === 0) {
      return <div className="text-sm text-muted-foreground italic">No details provided.</div>;
    }

    return (
      <div className="space-y-4">
        {entries.map(([key, value]) => (
          <div key={`${sectionKey}-${key}`} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {key.replace(/_/g, " ")}
            </div>
            <div className="mt-1.5 text-sm text-foreground">{renderJsonValue(value)}</div>
          </div>
        ))}
      </div>
    );
  }

  return renderJsonValue(data);
}

function ProposalDetailInner() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const proposalId = params.id as string;
  const justSubmitted = searchParams.get("submitted") === "1";
  const justResubmitted = searchParams.get("resubmitted") === "1";

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [piFeedbackOpen, setPiFeedbackOpen] = useState(false);
  const [piFeedbackActiveIndex, setPiFeedbackActiveIndex] = useState(0);

  const validFormSections = useMemo(
    () =>
      proposal?.form_data
        ? Object.entries(proposal.form_data).filter(
            ([section, data]) =>
              !HIDDEN_FORM_SECTIONS.has(section) &&
              data !== null &&
              typeof data === "object" &&
              !Array.isArray(data),
          )
        : [],
    [proposal?.form_data],
  );

  const tabFromUrl = searchParams.get("tab");

  useEffect(() => {
    if (!proposal) return;
    const validLeafTabs = new Set<string>(["documents", "letters", "messages"]);
    for (const [section] of validFormSections) {
      validLeafTabs.add(section);
    }
    if (tabFromUrl && validLeafTabs.has(tabFromUrl)) {
      setActiveNode(tabFromUrl);
      return;
    }
    setActiveNode((prev) => {
      if (prev) return prev;
      if (validFormSections.length > 0) return validFormSections[0][0];
      return "documents";
    });
  }, [proposal, tabFromUrl, validFormSections]);

  const treeData = [
    {
      id: "details-group",
      label: "Details",
      icon: <FileText className="h-4 w-4" />,
      children: validFormSections.map(([section]) => ({
        id: section,
        label: section.replace(/_/g, " "),
        icon: <FileText className="h-4 w-4" />,
      })),
    },
    {
      id: "documents",
      label: "Documents",
      icon: <Download className="h-4 w-4" />,
    },
    {
      id: "letters",
      label: "IRB feedback",
      icon: <ScrollText className="h-4 w-4" />,
    },
    {
      id: "messages",
      label: "Messages",
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ];

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      db.getProposal(proposalId),
      db.getMessages(proposalId),
      db.getProposalLetters(proposalId).catch(() => []),
      db.getCurrentAppUser(),
    ])
      .then(([p, m, letterRows, appUser]) => {
        if (cancelled) return;
        setProposal(p as ProposalDetail);
        setMessages(m as Message[]);
        setLetters(letterRows as Letter[]);
        setAppUserId(appUser?.id ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [proposalId]);

  useEffect(() => {
    if (activeNode !== "messages" || !proposalId || !appUserId) return;
    const hasUnread = messages.some((m) => !m.is_read && m.sender_user_id !== appUserId);
    if (!hasUnread) return;
    let cancelled = false;
    void (async () => {
      try {
        await db.markProposalMessagesRead(proposalId);
        if (cancelled) return;
        setMessages((prev) =>
          prev.map((m) => (m.sender_user_id !== appUserId ? { ...m, is_read: true } : m)),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeNode, proposalId, appUserId, messages]);

  useEffect(() => {
    if (!justSubmitted && !justResubmitted) return;
    const t = setTimeout(() => {
      router.replace(pathname, { scroll: false });
    }, 10000);
    return () => clearTimeout(t);
  }, [justSubmitted, justResubmitted, pathname, router]);

  async function sendMessage() {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const appUser = await db.getCurrentAppUser();
      if (!appUser) return;
      const msg = await db.sendMessage(proposalId, newMessage, appUser.id);
      setMessages((prev) => [...prev, msg as Message]);
      setNewMessage("");
    } catch {
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) {
    return <p className="text-muted-foreground">Proposal not found.</p>;
  }

  const submissionSnapshot = getSubmissionSnapshot(
    proposal.form_data as Record<string, unknown> | null,
  );
  function latestDocumentByFileName(fileName: string | undefined): ProposalDetail["documents"][number] | undefined {
    if (!fileName) return undefined;
    const matches = (proposal?.documents ?? []).filter((d) => d.file_name === fileName);
    if (matches.length === 0) return undefined;
    return matches.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0];
  }

  const sentRevisionLetters = letters
    .filter((l) => l.type === "revision" && l.sent_at)
    .sort((a, b) => new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime());

  const docxDocument =
    submissionSnapshot?.docx_file_name && proposal.documents?.length
      ? latestDocumentByFileName(submissionSnapshot.docx_file_name)
      : undefined;

  const pdfDocument =
    submissionSnapshot?.pdf_file_name && proposal.documents?.length
      ? latestDocumentByFileName(submissionSnapshot.pdf_file_name)
      : undefined;
  const aiWorkspace = (proposal.form_data as Record<string, unknown> | null)?.ai_workspace as
    | Record<string, unknown>
    | undefined;
  const contextAttachmentDocIds = new Set(
    Array.isArray(aiWorkspace?.context_attachments)
      ? aiWorkspace.context_attachments
          .map((item) =>
            item && typeof item === "object" && typeof (item as Record<string, unknown>).document_id === "string"
              ? (item as Record<string, unknown>).document_id
              : null,
          )
          .filter((id): id is string => Boolean(id))
      : [],
  );
  const extraMaterialDocIds = new Set(
    Array.isArray(aiWorkspace?.extra_materials)
      ? aiWorkspace.extra_materials
          .map((item) =>
            item && typeof item === "object" && typeof (item as Record<string, unknown>).document_id === "string"
              ? (item as Record<string, unknown>).document_id
              : null,
          )
          .filter((id): id is string => Boolean(id))
      : [],
  );
  const extraMaterialDescriptionByDocId = new Map<string, string>(
    Array.isArray(aiWorkspace?.extra_materials)
      ? aiWorkspace.extra_materials
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const o = item as Record<string, unknown>;
            if (typeof o.document_id !== "string" || !o.document_id) return null;
            const description = typeof o.description === "string" ? o.description.trim() : "";
            return [o.document_id, description] as const;
          })
          .filter((entry): entry is readonly [string, string] => Boolean(entry))
      : [],
  );
  const latestDocumentsByName = new Map<string, ProposalDetail["documents"][number]>();
  for (const doc of proposal.documents ?? []) {
    const prev = latestDocumentsByName.get(doc.file_name);
    if (!prev || new Date(doc.uploaded_at).getTime() > new Date(prev.uploaded_at).getTime()) {
      latestDocumentsByName.set(doc.file_name, doc);
    }
  }
  const visibleSupportingDocuments = Array.from(latestDocumentsByName.values())
    .filter((doc) => {
      // Main view should reflect only files included with the latest submission.
      if (!extraMaterialDocIds.has(doc.id)) return false;
      const lowerName = doc.file_name.toLowerCase();
      if (lowerName.endsWith(".md")) return false;
      if (/^proposal-package-.*\.(pdf|docx)$/.test(lowerName)) return false;
      if (/^irb-submission-.*\.(pdf|docx)$/.test(lowerName)) return false;
      if (submissionSnapshot?.docx_file_name && doc.file_name === submissionSnapshot.docx_file_name) return false;
      if (submissionSnapshot?.pdf_file_name && doc.file_name === submissionSnapshot.pdf_file_name) return false;
      if (docxDocument && doc.id === docxDocument.id) return false;
      if (pdfDocument && doc.id === pdfDocument.id) return false;
      if (submissionSnapshot && doc.file_name === submissionSnapshot.file_name) return false;
      if (contextAttachmentDocIds.has(doc.id) && !extraMaterialDocIds.has(doc.id)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

  async function downloadProposalDocument(documentId: string) {
    try {
      const { download_url } = await db.getProposalDocumentDownloadUrl(proposalId, documentId);
      window.open(download_url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {justSubmitted ? (
        <div
          className="flex gap-3 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm dark:bg-emerald-950/40"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-950 dark:text-emerald-100">Proposal submitted</p>
            <p className="mt-1 text-muted-foreground">
              Your finalized submission document is listed under the Documents tab. The IRB team will review your
              materials; use Messages to ask questions or share updates.
            </p>
          </div>
        </div>
      ) : null}

      {justResubmitted ? (
        <div
          className="flex gap-3 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm dark:bg-emerald-950/40"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-950 dark:text-emerald-100">Revised submission resubmitted</p>
            <p className="mt-1 text-muted-foreground">
              Updated submission files appear under Documents. The IRB team will continue
              review; use Messages for follow-up.
            </p>
          </div>
        </div>
      ) : null}

      {proposal.status === "revisions_requested" && sentRevisionLetters.length > 0 ? (
        <div
          className="flex flex-col gap-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:bg-amber-950/30"
          role="status"
        >
          <div>
            <p className="font-medium text-amber-950 dark:text-amber-100">Revisions requested</p>
            <p className="mt-1 text-muted-foreground">
              Your IRB office sent formal feedback. Review it in the IRB feedback tab, then use{" "}
              <strong className="text-foreground">Edit &amp; resubmit</strong> to open the AI workspace,
              revise your protocol submission and resubmit.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 cursor-pointer"
            onClick={() => setActiveNode("letters")}
          >
            <ScrollText className="mr-2 h-4 w-4" />
            View IRB feedback
          </Button>
        </div>
      ) : null}

      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="mt-1 cursor-pointer"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-2xl">{proposal.title}</h1>
            <StatusBadge status={proposal.status} />
          </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Submitted {proposal.submitted_at ? new Date(proposal.submitted_at).toLocaleDateString() : "—"} &middot;{" "}
              {proposal.document_count + (submissionSnapshot ? 1 : 0)} document
              {proposal.document_count + (submissionSnapshot ? 1 : 0) !== 1 ? "s" : ""}
            </p>
        </div>
        {proposal.status === "revisions_requested" ? (
          <Button className="gap-2 cursor-pointer" render={<Link href={`/dashboard/proposals/${proposalId}/edit`} />}>
            <PencilLine className="h-4 w-4" />
            Edit &amp; resubmit
          </Button>
        ) : proposal.status === "draft" ? (
          <Button className="gap-2 cursor-pointer" render={<Link href={`/dashboard/proposals/${proposalId}/edit`} />}>
            <PencilLine className="h-4 w-4" />
            Continue editing
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Sidebar navigation */}
        <div className="w-full shrink-0 md:w-64">
          <TreeView
            className="border-none bg-transparent p-0"
            data={treeData}
            defaultExpandedIds={["details-group"]}
            selectedIds={activeNode ? [activeNode] : []}
            onNodeClick={(node) => {
              if (node.children) return;
              setActiveNode(node.id);
            }}
            showIcons={true}
            showLines={false}
          />
        </div>

        {/* Main content area */}
        <div className="min-w-0 flex-1">
          {activeNode === "documents" ? (
            <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
              <CardContent className="pt-6">
                {proposal.documents.length === 0 && !submissionSnapshot ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No documents uploaded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {submissionSnapshot ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {submissionSnapshot.docx_file_name || submissionSnapshot.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Finalized submission document ·{" "}
                              {new Date(submissionSnapshot.submitted_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {pdfDocument ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => void downloadProposalDocument(pdfDocument.id)}
                            >
                              <Download className="mr-1.5 h-4 w-4" />
                              PDF
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">PDF not available</span>
                          )}
                          {docxDocument ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => void downloadProposalDocument(docxDocument.id)}
                            >
                              <Download className="mr-1.5 h-4 w-4" />
                              Word (.docx)
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {visibleSupportingDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.file_name}</p>
                            {extraMaterialDescriptionByDocId.get(doc.id) ? (
                              <p className="text-xs text-muted-foreground">
                                {extraMaterialDescriptionByDocId.get(doc.id)}
                              </p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              Included in latest submission · originally uploaded{" "}
                              {new Date(doc.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer"
                          type="button"
                          onClick={() => void downloadProposalDocument(doc.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : activeNode === "letters" ? (
            <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
              <CardHeader className="pb-2">
                <CardTitle className="font-sans text-base font-semibold">IRB feedback</CardTitle>
                <CardDescription>
                  Formal revision letters from your IRB office. Status also appears in the header (
                  <strong>Revisions requested</strong>).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {sentRevisionLetters.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                    No formal letters have been sent yet. When your office requests revisions, the letter will
                    appear here and you will receive an email if your institution has mail enabled.
                  </p>
                ) : (
                  <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {sentRevisionLetters.length} feedback letter
                          {sentRevisionLetters.length === 1 ? "" : "s"} on file
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Open the feedback modal for a wide, easier-to-read view.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => {
                          setPiFeedbackActiveIndex(0);
                          setPiFeedbackOpen(true);
                        }}
                      >
                        Open IRB feedback
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : activeNode === "messages" ? (
            <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
              <CardContent className="p-0">
                <MessagesThread
                  messages={messages}
                  viewerUserId={appUserId}
                  emptyLabel="No messages yet. Start a conversation with the IRB office."
                  scrollAreaClassName="h-[400px] p-4"
                />
                <Separator />
                <div className="flex gap-2 p-4">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !sending && sendMessage()}
                    disabled={sending}
                    className={`rounded-md ${dashboardInputClass}`}
                  />
                  <Button
                    size="icon"
                    className="cursor-pointer"
                    onClick={sendMessage}
                    disabled={sending}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            validFormSections.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No form details available for this proposal.
              </p>
            ) : (
              validFormSections
                .filter(([section]) => section === activeNode)
                .map(([section, data]) => (
                  <Card
                    className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}
                    key={section}
                  >
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg capitalize tracking-tight">
                        {section.replace(/_/g, " ")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {renderFormSectionBody(section, data)}
                    </CardContent>
                  </Card>
                ))
            )
          )}
        </div>
      </div>

      <Dialog open={piFeedbackOpen} onOpenChange={setPiFeedbackOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[1400px] p-0 sm:max-w-[1400px] sm:w-[calc(100vw-2rem)]">
          <div className="flex h-[min(calc(100dvh-2rem),620px)] flex-col overflow-hidden">
            <DialogHeader className="shrink-0 border-b border-border/60 bg-background px-6 pb-4 pt-6 sm:px-7">
              <DialogTitle className="font-sans">IRB feedback</DialogTitle>
              <DialogDescription>
                Formal revision letters from your IRB office. Select a letter on the left to read it.
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[360px_1fr]">
              <div className="min-h-0 border-b border-border/60 bg-muted/10 p-3 sm:border-b-0 sm:border-r sm:p-4">
                <div className="h-full overflow-auto pr-1">
                  <div className="space-y-1">
                    {sentRevisionLetters.map((letter, idx) => (
                      <button
                        key={letter.id}
                        type="button"
                        onClick={() => setPiFeedbackActiveIndex(idx)}
                        className={cn(
                          "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          piFeedbackActiveIndex === idx
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                        )}
                      >
                        <span className="block text-[0.7rem] font-semibold uppercase tracking-wide">Revision letter</span>
                        <span className="mt-1 block text-xs">
                          {letter.sent_at
                            ? new Date(letter.sent_at).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "Draft"}
                        </span>
                      </button>
                    ))}
                    {sentRevisionLetters.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No formal letters have been sent yet.</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="min-h-0 bg-background p-4 sm:p-6">
                <div className="h-full overflow-auto pr-1">
                  {sentRevisionLetters.length > 0 ? (
                    (() => {
                      const letter = sentRevisionLetters[Math.min(piFeedbackActiveIndex, sentRevisionLetters.length - 1)];
                      return (
                        <div className="mx-auto w-full max-w-3xl">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Revision letter
                          </p>
                          <div className="mt-3 border-t border-border/40 pt-4">
                            <ProposalMarkdownPreview markdown={letter.content} className="text-sm leading-relaxed" />
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="mx-auto w-full max-w-3xl">
                      <p className="text-sm text-muted-foreground">No formal letters have been sent yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProposalDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProposalDetailInner />
    </Suspense>
  );
}
