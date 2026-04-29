"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Brain,
  Send,
  UserPlus,
  FileEdit,
  Loader2,
  AlertCircle,
  Calendar,
  FileStack,
  ChevronDown,
  Download,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { dashboardCardClass, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { TreeView } from "@/components/ui/tree-view";
import { MessagesThread } from "@/components/messages/MessagesThread";
import { db } from "@/lib/database";
import { assignReviewersViaApi } from "@/lib/assign-reviewers-api";
import { updateProposalStatusViaApi } from "@/lib/update-proposal-status-api";
import { getSubmissionSnapshot } from "@/lib/submission-snapshot";
import type {
  Letter,
  ProposalDetail,
  ProposalStatus,
  Review,
  ReviewAssignment,
  ReviewDecision,
  Message,
  User,
} from "@/lib/types";

const TAB_VALUES = ["summary", "details", "reviewers", "letter", "messages", "submit_review"] as const;
type TabValue = (typeof TAB_VALUES)[number];

const ProposalCanvasEditor = dynamic(
  () => import("@/components/proposals/ProposalCanvasEditor").then((m) => m.ProposalCanvasEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-[min(55vh,34rem)] animate-pulse rounded-none bg-muted/10" />,
  },
);

/** Large / internal blobs — hide from admin Details for clarity (PI still has full data elsewhere). */
const ADMIN_DETAILS_SKIP = new Set(["ai_workspace", "submission_snapshot"]);

/** Shown in the compact horizontal strip on the Summary tab. */
const SUMMARY_COMPACT_KEYS = new Set([
  "risk_level",
  "regulatory_category_suggestion",
  "data_sensitivity",
]);

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

function recordString(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  fallback = "",
): string {
  if (!obj) return fallback;
  const v = obj[key];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return fallback;
}

/** Avoid "Objects are not valid as a React child" for nested JSON in form_data / summaries. */
function renderJsonValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return markdownToPlainText(value);
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

/**
 * `Object.entries("ai-draft")` yields per-character rows — never treat strings as record maps.
 */
function renderFormSectionBody(sectionKey: string, data: unknown): ReactNode {
  if (data === null || data === undefined) return null;

  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return <div className="text-sm leading-relaxed text-muted-foreground">{renderJsonValue(data)}</div>;
  }

  if (Array.isArray(data)) {
    return <div className="text-sm">{renderJsonValue(data)}</div>;
  }

  if (typeof data === "object") {
    return (
      <div className="space-y-4">
        {Object.entries(data as Record<string, unknown>).map(([key, value]) => {
          if (value === null || value === undefined || value === "") return null;
          return (
            <div key={`${sectionKey}-${key}`} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {key.replace(/_/g, " ")}
              </div>
              <div className="mt-1.5 text-sm text-foreground">{renderJsonValue(value)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return renderJsonValue(data);
}

function AdminProposalDetailInner() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const proposalId = params.id as string;

  const tabParam = searchParams.get("tab");

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [revisionLetter, setRevisionLetter] = useState("");
  const [pendingLetterId, setPendingLetterId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingLetter, setSendingLetter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveConfirmText, setApproveConfirmText] = useState("");
  const [fullSummaryOpen, setFullSummaryOpen] = useState(false);
  const [fullSummaryActiveKey, setFullSummaryActiveKey] = useState<string | null>(null);
  const [aiFlagsOpen, setAiFlagsOpen] = useState(false);
  const [aiFlagsActiveIndex, setAiFlagsActiveIndex] = useState(0);
  const [revisionLetterOpen, setRevisionLetterOpen] = useState(false);
  const [reviewerHubOpen, setReviewerHubOpen] = useState(false);
  const [reviewerHubPanel, setReviewerHubPanel] = useState<
    "workflow" | "assign" | "assignments" | "reviews" | "history"
  >("workflow");
  const [activeNode, setActiveNode] = useState<string | null>(null);
  /** When set, reviewers see AI summary / details / messages but not workflow or admin-only tabs. */
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision | "">("");
  const [reviewComments, setReviewComments] = useState({
    overall: "",
    methodology: "",
    ethics: "",
    risk_assessment: "",
    recommendations: "",
  });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fullSummaryEntries =
    summary ? Object.entries(summary).filter(([key]) => !SUMMARY_COMPACT_KEYS.has(key)) : [];

  const validFormSections = proposal?.form_data
    ? Object.entries(proposal.form_data).filter(
        ([section, data]) =>
          !ADMIN_DETAILS_SKIP.has(section) &&
          data !== null &&
          typeof data === "object" &&
          !Array.isArray(data),
      )
    : [];

  useEffect(() => {
    const fromUrl =
      tabParam && TAB_VALUES.includes(tabParam as TabValue) ? (tabParam as TabValue) : null;
    setActiveNode(fromUrl ?? "summary");
  }, [tabParam, proposalId]);

  /** Reviewers must not land on admin-only tabs from bookmarks. */
  useEffect(() => {
    if (staffRole !== "reviewer") return;
    if (tabParam !== "reviewers" && tabParam !== "letter") return;
    const q = new URLSearchParams(searchParams.toString());
    q.set("tab", "summary");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [staffRole, tabParam, pathname, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await db.getCurrentAppUser();
      if (cancelled) return;
      setStaffRole(u?.role ?? null);
      setAppUserId(u?.id ?? null);
      const isAdmin = u?.role === "admin";

      const instUsersPromise = isAdmin
        ? db.getInstitutionUsers().catch(() => [])
        : Promise.resolve([] as User[]);

      try {
        const [p, r, a, letterRows, aiSummary, m, uList] = await Promise.all([
          db.getProposal(proposalId),
          db.getReviews(proposalId).catch(() => []),
          db.getReviewAssignmentsForProposal(proposalId).catch(() => []),
          db.getProposalLetters(proposalId).catch(() => []),
          db.getLatestAiSummary(proposalId).catch(() => null),
          db.getMessages(proposalId).catch(() => []),
          instUsersPromise,
        ]);
        if (cancelled) return;
        setProposal(p as ProposalDetail);
        setReviews(r as Review[]);
        setAssignments(a as ReviewAssignment[]);
        setLetters(letterRows as Letter[]);
        if (aiSummary) setSummary(aiSummary);
        setMessages(m as Message[]);
        setUsers(uList as User[]);

        const list = letterRows as Letter[];
        const unsent = list.find((l) => l.type === "revision" && !l.sent_at);
        if (unsent) {
          setRevisionLetter(unsent.content);
          setPendingLetterId(unsent.id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
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

  function setTab(next: TabValue) {
    const q = new URLSearchParams(searchParams.toString());
    q.set("tab", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  async function generateSummary() {
    setSummarizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        summary?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `Generate summary failed (${res.status})`);
      if (!json.summary) throw new Error("No summary returned");
      const out = json.summary;
      setSummary(out);
      setBanner("Summary generated and saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSummarizing(false);
    }
  }

  async function draftRevisionLetter() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/draft-revision-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string } & Partial<Letter>;
      if (!res.ok) {
        throw new Error(json.error || `AI draft failed (${res.status})`);
      }
      if (!json.id || typeof json.content !== "string") {
        throw new Error("Invalid draft response");
      }
      const letter = json as Letter;
      setRevisionLetter(letter.content);
      setPendingLetterId(letter.id);
      setLetters((prev) => [letter, ...prev.filter((x) => x.id !== letter.id)]);
      setBanner("Draft saved — review the text, then send to the PI.");
      setRevisionLetterOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  async function sendRevisionLetterToPi() {
    if (!revisionLetter.trim()) return;
    setSendingLetter(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/send-revision-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: revisionLetter,
          letter_id: pendingLetterId ?? undefined,
          transition_to_revisions_requested: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        letter?: Letter;
        status?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || `Send letter failed (${res.status})`);
      }
      if (!json.letter?.id) {
        throw new Error("Invalid response from server");
      }
      setProposal((prev) =>
        prev ? { ...prev, status: (json.status as ProposalStatus) ?? prev.status } : prev,
      );
      setLetters((prev) => {
        const next = prev.filter((x) => x.id !== json.letter!.id);
        return [json.letter as Letter, ...next];
      });
      setPendingLetterId(null);
      setBanner(
        "Revision letter saved for the PI in the app. Status set to Revisions Requested when allowed.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSendingLetter(false);
    }
  }

  async function updateStatus(newStatus: ProposalStatus) {
    setStatusUpdating(true);
    setError(null);
    try {
      const updated = await updateProposalStatusViaApi(proposalId, newStatus);
      setProposal((prev) => prev && { ...prev, status: updated.status });
      setBanner(`Status updated to ${updated.status.replace(/_/g, " ")}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatusUpdating(false);
    }
  }

  async function confirmRequestRevisionsOnly() {
    setStatusUpdating(true);
    setError(null);
    try {
      const updated = await updateProposalStatusViaApi(proposalId, "revisions_requested");
      setProposal((prev) => prev && { ...prev, status: updated.status });
      if (revisionNote.trim()) {
        const appUser = await db.getCurrentAppUser();
        if (appUser) {
          const msg = await db.sendMessage(
            proposalId,
            `[Revision request] ${revisionNote.trim()}`,
            appUser.id,
          );
          setMessages((prev) => [...prev, msg as Message]);
        }
      }
      setRevisionDialogOpen(false);
      setRevisionNote("");
      setBanner("Status set to Revisions Requested.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatusUpdating(false);
    }
  }

  async function assignReviewer() {
    if (!selectedReviewer) return;
    setAssigning(true);
    setError(null);
    try {
      await assignReviewersViaApi(proposalId, [selectedReviewer]);
      setSelectedReviewer("");
      const next = await db.getReviewAssignmentsForProposal(proposalId);
      setAssignments(next);
      setBanner("Reviewer assigned.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleSubmitReviewerForm() {
    if (!reviewDecision) return;
    const mine = assignments.find((a) => appUserId && a.reviewer_user_id === appUserId);
    if (!mine) {
      setError("No review assignment found for your account on this proposal.");
      return;
    }
    if (mine.status === "submitted") return;
    setReviewSubmitting(true);
    setError(null);
    try {
      await db.submitReview(mine.id, reviewDecision, reviewComments);
      setAssignments((prev) =>
        prev.map((a) => (a.id === mine.id ? { ...a, status: "submitted" as const } : a)),
      );
      const nextReviews = await db.getReviews(proposalId);
      setReviews(nextReviews as Review[]);
      setBanner("Your review was submitted. The IRB office will be notified.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;
    setSending(true);
    setError(null);
    try {
      const appUser = await db.getCurrentAppUser();
      if (!appUser) return;
      const msg = await db.sendMessage(proposalId, newMessage, appUser.id);
      setMessages((prev) => [...prev, msg as Message]);
      setNewMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) {
    return <p className="text-muted-foreground">Proposal not found.</p>;
  }

  const isStaffReviewer = staffRole === "reviewer";

  const myReviewerAssignment =
    isStaffReviewer && appUserId
      ? assignments.find((a) => a.reviewer_user_id === appUserId)
      : undefined;

  const aiWorkspace =
    proposal.form_data &&
    typeof proposal.form_data === "object" &&
    !Array.isArray(proposal.form_data) &&
    "ai_workspace" in proposal.form_data
      ? ((proposal.form_data as Record<string, unknown>).ai_workspace as Record<string, unknown> | null)
      : null;
  const complianceFlags = Array.isArray(aiWorkspace?.compliance_flags)
    ? (aiWorkspace?.compliance_flags as Array<Record<string, unknown>>)
    : [];

  const treeData = [
    {
      id: "summary",
      label: "AI Summary",
    },
    ...(complianceFlags.length > 0
      ? [
          {
            id: "ai_flags",
            label: "AI Flagged Items",
          },
        ]
      : []),
    {
      id: "details-group",
      label: "Details",
      children: validFormSections.map(([section]) => ({
        id: section,
        label: section.replace(/_/g, " "),
      })),
    },
    ...(isStaffReviewer
      ? []
      : [
          {
            id: "reviewers",
            label: "Reviewer & Workflow Hub",
          },
          {
            id: "letter",
            label: "Revision Letter",
          },
        ]),
    {
      id: "messages",
      label: "Messages",
    },
    ...(isStaffReviewer
      ? [
          {
            id: "submit_review",
            label: "Submit Review",
          },
        ]
      : []),
  ];

  const reviewers = users.filter((u) => u.role === "reviewer");
  const submittedAt = proposal.submitted_at
    ? new Date(proposal.submitted_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const canRequestRevisions =
    proposal.status === "initial_review" || proposal.status === "under_committee_review";

  const submissionSnapshot = getSubmissionSnapshot(
    proposal.form_data as Record<string, unknown> | null,
  );
  const docxDocument =
    submissionSnapshot?.docx_file_name && proposal.documents?.length
      ? proposal.documents.find((d) => d.file_name === submissionSnapshot.docx_file_name)
      : undefined;
  const pdfDocument =
    submissionSnapshot?.pdf_file_name && proposal.documents?.length
      ? proposal.documents.find((d) => d.file_name === submissionSnapshot.pdf_file_name)
      : undefined;
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
  const generatedSubmissionArtifactRe = /^(proposal-package-|irb-submission-).*\.(pdf|docx)$/i;
  const latestDocumentsByName = new Map<string, ProposalDetail["documents"][number]>();
  for (const doc of proposal.documents ?? []) {
    const prev = latestDocumentsByName.get(doc.file_name);
    if (!prev || new Date(doc.uploaded_at).getTime() > new Date(prev.uploaded_at).getTime()) {
      latestDocumentsByName.set(doc.file_name, doc);
    }
  }
  const visibleSupportingDocuments = Array.from(latestDocumentsByName.values())
    .filter((doc) => {
      const lowerName = doc.file_name.toLowerCase();
      if (lowerName.endsWith(".md")) return false;
      // Hide generated submission artifacts from the generic files list.
      if (generatedSubmissionArtifactRe.test(lowerName)) return false;
      if (submissionSnapshot?.docx_file_name && doc.file_name === submissionSnapshot.docx_file_name) {
        return false;
      }
      if (submissionSnapshot?.pdf_file_name && doc.file_name === submissionSnapshot.pdf_file_name) {
        return false;
      }
      if (docxDocument && doc.id === docxDocument.id) return false;
      if (pdfDocument && doc.id === pdfDocument.id) return false;
      if (
        submissionSnapshot &&
        doc.file_name === submissionSnapshot.file_name
      ) {
        return false;
      }
      if (contextAttachmentDocIds.has(doc.id) && !extraMaterialDocIds.has(doc.id)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

  const submissionHistoryByStem = new Map<
    string,
    { stem: string; at: string; files: ProposalDetail["documents"] }
  >();
  for (const doc of proposal.documents ?? []) {
    if (!generatedSubmissionArtifactRe.test(doc.file_name.toLowerCase())) continue;
    const stem = doc.file_name.replace(/\.(pdf|docx)$/i, "");
    const prev = submissionHistoryByStem.get(stem);
    if (!prev) {
      submissionHistoryByStem.set(stem, { stem, at: doc.uploaded_at, files: [doc] });
      continue;
    }
    prev.files.push(doc);
    if (new Date(doc.uploaded_at).getTime() > new Date(prev.at).getTime()) prev.at = doc.uploaded_at;
  }
  const submissionHistory = Array.from(submissionHistoryByStem.values()).sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  async function openStoredDocumentDownload(documentId: string) {
    setError(null);
    try {
      const { download_url } = await db.getProposalDocumentDownloadUrl(proposalId, documentId);
      window.open(download_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 pb-16">
      <div className="flex flex-col gap-6 border-b border-border/70 pb-8">
        <div className="flex items-start gap-3 sm:gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 cursor-pointer"
            onClick={() => router.back()}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {proposal.title}
              </h1>
              <StatusBadge status={proposal.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>
                PI: <span className="text-foreground">{proposal.pi_name || "—"}</span>
              </span>
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <span>
                Type:{" "}
                <span className="text-foreground">
                  {proposal.review_type?.replace(/_/g, " ") || "—"}
                </span>
              </span>
              {submittedAt ? (
                <>
                  <span className="hidden sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    Submitted {submittedAt}
                  </span>
                </>
              ) : null}
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileStack className="h-3.5 w-3.5 opacity-70" aria-hidden />
                {proposal.document_count} document{proposal.document_count === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {banner ? (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-foreground"
          >
            <span>{banner}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 cursor-pointer"
              onClick={() => setBanner(null)}
            >
              Dismiss
            </Button>
          </div>
        ) : null}

        {submissionSnapshot || (proposal.documents && proposal.documents.length > 0) ? (
          <Card className="border-0 bg-transparent shadow-none hover:border-0 hover:shadow-none">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Submission documents &amp; files
              </CardTitle>
              <CardDescription>
                Finalized submission files are provided as Word and optional PDF. Supporting materials are listed
                separately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {submissionSnapshot ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/10 px-3 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Finalized submission document</p>
                    <p className="text-xs text-muted-foreground">
                      {submissionSnapshot.docx_file_name || submissionSnapshot.file_name}
                    </p>
                  </div>
                  {docxDocument ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="cursor-pointer shrink-0"
                      onClick={() => void openStoredDocumentDownload(docxDocument.id)}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Word (.docx)
                    </Button>
                  ) : submissionSnapshot.docx_file_name ? (
                    <span className="text-xs text-muted-foreground">Word file pending or missing</span>
                  ) : null}
                  {pdfDocument ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer shrink-0"
                      onClick={() => void openStoredDocumentDownload(pdfDocument.id)}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      PDF
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {visibleSupportingDocuments.length > 0 ? (
                <ul className="space-y-1.5">
                  {visibleSupportingDocuments.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{doc.file_name}</p>
                        {extraMaterialDescriptionByDocId.get(doc.id) ? (
                          <p className="text-xs text-muted-foreground">
                            {extraMaterialDescriptionByDocId.get(doc.id)}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.uploaded_at).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer shrink-0"
                        onClick={() => void openStoredDocumentDownload(doc.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : !submissionSnapshot ? (
                <p className="text-sm text-muted-foreground">No uploaded files yet.</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Workflow controls moved into Reviewer & workflow hub modal */}
      </div>

      <Dialog open={reviewerHubOpen} onOpenChange={setReviewerHubOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[1400px] p-0 sm:max-w-[1400px] sm:w-[calc(100vw-2rem)]">
          <div className="flex h-[min(calc(100dvh-2rem),620px)] flex-col overflow-hidden">
            <DialogHeader className="shrink-0 border-b border-border/60 bg-background px-6 pb-4 pt-6 sm:px-7">
              <DialogTitle className="font-sans">Reviewer &amp; workflow hub</DialogTitle>
              <DialogDescription>
                Assign reviewers, move review status forward, and request revisions. This is the admin control center.
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[360px_1fr]">
              <div className="min-h-0 border-b border-border/60 bg-muted/10 p-3 sm:border-b-0 sm:border-r sm:p-4">
                <div className="h-full overflow-auto pr-1">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setReviewerHubPanel("workflow")}
                      className={cn(
                        "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        reviewerHubPanel === "workflow"
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                      )}
                    >
                      <span className="block text-[0.7rem] font-semibold uppercase tracking-wide">Workflow actions</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewerHubPanel("assign")}
                      className={cn(
                        "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        reviewerHubPanel === "assign"
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                      )}
                    >
                      <span className="block text-[0.7rem] font-semibold uppercase tracking-wide">Assign reviewer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewerHubPanel("assignments")}
                      className={cn(
                        "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        reviewerHubPanel === "assignments"
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                      )}
                    >
                      <span className="block text-[0.7rem] font-semibold uppercase tracking-wide">
                        Current assignments ({assignments.length})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewerHubPanel("reviews")}
                      className={cn(
                        "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        reviewerHubPanel === "reviews"
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                      )}
                    >
                      <span className="block text-[0.7rem] font-semibold uppercase tracking-wide">
                        Submitted reviews ({reviews.length})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewerHubPanel("history")}
                      className={cn(
                        "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        reviewerHubPanel === "history"
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                      )}
                    >
                      <span className="block text-[0.7rem] font-semibold uppercase tracking-wide">
                        Submission history ({submissionHistory.length})
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="min-h-0 bg-background p-4 sm:p-6">
                <div className="h-full overflow-auto pr-1">
                  <div className="mx-auto w-full max-w-3xl">
                    {reviewerHubPanel === "workflow" ? (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Workflow actions
                        </p>
                        {!isStaffReviewer ? (
                          <div className="space-y-4 border-t border-border/40 pt-4">
                            <p className="text-xs text-muted-foreground">
                              Current status:{" "}
                              <span className="font-medium text-foreground">{proposal.status.replace(/_/g, " ")}</span>
                            </p>

                            <div className="flex flex-wrap gap-2">
                              {proposal.status === "submitted" ? (
                                <Button
                                  size="sm"
                                  className="cursor-pointer"
                                  onClick={() => void updateStatus("initial_review")}
                                  disabled={statusUpdating}
                                >
                                  Begin review
                                </Button>
                              ) : null}
                              {proposal.status === "initial_review" ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="cursor-pointer"
                                    onClick={() => setApproveDialogOpen(true)}
                                    disabled={statusUpdating}
                                  >
                                    Approve
                                  </Button>
                                </>
                              ) : null}
                              {proposal.status === "under_committee_review" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="cursor-pointer"
                                  onClick={() => setApproveDialogOpen(true)}
                                  disabled={statusUpdating}
                                >
                                  Approve
                                </Button>
                              ) : null}
                              {proposal.status === "resubmitted" ? (
                                <Button
                                  size="sm"
                                  className="cursor-pointer"
                                  onClick={() => void updateStatus("initial_review")}
                                  disabled={statusUpdating}
                                >
                                  Begin re-review
                                </Button>
                              ) : null}
                            </div>

                            {canRequestRevisions ? (
                              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/80 bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-foreground">Propose revisions to the PI</p>
                                  <p className="text-xs leading-relaxed text-muted-foreground">
                                    Draft a formal letter, or change status now and optionally post a short note to Messages.
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="cursor-pointer"
                                    onClick={() => setRevisionLetterOpen(true)}
                                  >
                                    <FileEdit className="mr-2 h-4 w-4" />
                                    Open revision letter
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="cursor-pointer"
                                    onClick={() => setRevisionDialogOpen(true)}
                                  >
                                    Status + note
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="border-t border-border/40 pt-4">
                            <p className="text-sm text-muted-foreground">Reviewer accounts can view status but cannot update it.</p>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {reviewerHubPanel === "assign" ? (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assign reviewer</p>
                        {!isStaffReviewer ? (
                          <div className="space-y-3 border-t border-border/40 pt-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <Select value={selectedReviewer} onValueChange={(v) => setSelectedReviewer(v ?? "")}>
                                <SelectTrigger className="flex-1 rounded-xl">
                                  <SelectValue placeholder="Select a reviewer" />
                                </SelectTrigger>
                                <SelectContent>
                                  {reviewers.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                      {r.full_name} ({r.email})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                className="cursor-pointer shrink-0 sm:w-auto"
                                onClick={() => void assignReviewer()}
                                disabled={!selectedReviewer || assigning}
                              >
                                {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                Assign
                              </Button>
                            </div>
                            {reviewers.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No reviewer accounts in your institution yet.</p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="border-t border-border/40 pt-4">
                            <p className="text-sm text-muted-foreground">Reviewer accounts cannot assign reviewers.</p>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {reviewerHubPanel === "assignments" ? (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current assignments</p>
                        <div className="border-t border-border/40 pt-4">
                          {assignments.length > 0 ? (
                            <div className="space-y-2">
                              {assignments.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-4 py-3"
                                >
                                  <div>
                                    <p className="text-sm font-medium">{a.reviewer_name || "Reviewer"}</p>
                                    <p className="text-xs text-muted-foreground capitalize">
                                      {a.status.replace(/_/g, " ")} · Assigned {new Date(a.assigned_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No reviewers assigned yet.</p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {reviewerHubPanel === "reviews" ? (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted reviews</p>
                        <div className="border-t border-border/40 pt-4">
                          {reviews.length > 0 ? (
                            <div className="space-y-3">
                              {reviews.map((r) => (
                                <div key={r.id} className="rounded-xl border border-border p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-sm font-semibold capitalize">{r.decision.replace(/_/g, " ")}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(r.submitted_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {r.comments ? (
                                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                      {Object.entries(r.comments).map(([k, v]) => (
                                        <div key={k} className="space-y-1">
                                          <strong className="capitalize text-foreground">{k.replace(/_/g, " ")}:</strong>
                                          <div className="pl-0">{renderJsonValue(v as unknown)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No submitted reviews yet.</p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {reviewerHubPanel === "history" ? (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submission history</p>
                        <div className="border-t border-border/40 pt-4">
                          {submissionHistory.length > 0 ? (
                            <ol className="relative ml-2 border-l border-border/60 pl-5">
                              {submissionHistory.map((entry, entryIndex) => {
                                const isCurrent =
                                  !!submissionSnapshot &&
                                  (entry.files.some((f) => f.file_name === submissionSnapshot.docx_file_name) ||
                                    entry.files.some((f) => f.file_name === submissionSnapshot.pdf_file_name));
                                const entryAtMs = new Date(entry.at).getTime();
                                const olderEntryAtMs =
                                  entryIndex < submissionHistory.length - 1
                                    ? new Date(submissionHistory[entryIndex + 1].at).getTime()
                                    : Number.NEGATIVE_INFINITY;
                                const extraFilesInWindow = (proposal.documents ?? [])
                                  .filter((doc) => {
                                    if (!extraMaterialDocIds.has(doc.id)) return false;
                                    if (generatedSubmissionArtifactRe.test(doc.file_name.toLowerCase())) return false;
                                    const t = new Date(doc.uploaded_at).getTime();
                                    return t <= entryAtMs && t > olderEntryAtMs;
                                  })
                                  .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
                                return (
                                  <li key={entry.stem} className="mb-5 last:mb-0">
                                    <span className="-left-[1.42rem] absolute mt-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/60" />
                                    <div className="rounded-lg border border-border/60 px-3 py-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-medium text-foreground">
                                          {new Date(entry.at).toLocaleString()}
                                        </p>
                                        {isCurrent ? (
                                          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700">
                                            Current
                                          </span>
                                        ) : null}
                                      </div>
                                      <ul className="mt-2 space-y-2">
                                        {entry.files
                                          .sort((a, b) => a.file_name.localeCompare(b.file_name))
                                          .map((f) => (
                                            <li
                                              key={f.id}
                                              className="rounded-md border border-border/50 bg-muted/10 px-2.5 py-2"
                                            >
                                              <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                  <p className="truncate text-xs font-medium text-foreground">
                                                    {f.file_name}
                                                  </p>
                                                  <p className="text-[0.68rem] text-muted-foreground">
                                                    Uploaded {new Date(f.uploaded_at).toLocaleString()}
                                                  </p>
                                                </div>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 cursor-pointer px-2"
                                                  onClick={() => void openStoredDocumentDownload(f.id)}
                                                >
                                                  <Download className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </li>
                                          ))}
                                      </ul>
                                      <details className="mt-2">
                                        <summary className="cursor-pointer text-[0.72rem] font-medium text-muted-foreground">
                                          Explore more
                                        </summary>
                                        <div className="mt-1.5 space-y-2 rounded-md border border-border/50 bg-muted/10 px-2.5 py-2 text-[0.7rem] text-muted-foreground">
                                          <div>
                                            <p className="font-medium text-foreground">
                                              Extra files submitted with this entry ({extraFilesInWindow.length})
                                            </p>
                                            {extraFilesInWindow.length > 0 ? (
                                              <ul className="mt-1 list-inside list-disc space-y-0.5">
                                                {extraFilesInWindow.map((extra) => (
                                                  <li key={extra.id}>
                                                    {extra.file_name}
                                                    {extraMaterialDescriptionByDocId.get(extra.id)
                                                      ? ` — ${extraMaterialDescriptionByDocId.get(extra.id)}`
                                                      : ""}
                                                  </li>
                                                ))}
                                              </ul>
                                            ) : (
                                              <p className="mt-1">No extra files detected for this submission window.</p>
                                            )}
                                          </div>
                                        </div>
                                      </details>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          ) : (
                            <p className="text-sm text-muted-foreground">No prior submission artifacts found.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fullSummaryOpen} onOpenChange={setFullSummaryOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[1400px] p-0 sm:max-w-[1400px] sm:w-[calc(100vw-2rem)]">
          <div className="flex h-[min(calc(100dvh-2rem),620px)] flex-col overflow-hidden">
            <DialogHeader className="shrink-0 border-b border-border/60 bg-background px-6 pb-4 pt-6 sm:px-7">
              <DialogTitle className="font-sans">Full AI summary</DialogTitle>
              <DialogDescription>
                Use the left panel to jump between sections. This view is read-only.
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[360px_1fr]">
              <div className="min-h-0 border-b border-border/60 bg-muted/10 p-3 sm:border-b-0 sm:border-r sm:p-4">
                <div className="h-full overflow-auto pr-1">
                  <div className="space-y-1">
                    {fullSummaryEntries.map(([key]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFullSummaryActiveKey(key)}
                        className={cn(
                          "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          fullSummaryActiveKey === key
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                        )}
                      >
                        <span className="block text-[0.7rem] font-semibold uppercase tracking-wide">
                          {key.replace(/_/g, " ")}
                        </span>
                      </button>
                    ))}
                    {fullSummaryEntries.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No additional summary fields.</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="min-h-0 bg-background p-4 sm:p-6">
                <div className="h-full overflow-auto pr-1">
                  {summary && fullSummaryActiveKey ? (
                    <div className="mx-auto w-full max-w-3xl">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {fullSummaryActiveKey.replace(/_/g, " ")}
                      </p>
                      <div className="mt-3 border-t border-border/40 pt-4">
                        <div className="text-sm leading-relaxed text-foreground">
                          {renderJsonValue((summary as Record<string, unknown>)[fullSummaryActiveKey])}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto w-full max-w-3xl">
                      <p className="text-sm text-muted-foreground">Select a section to view details.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aiFlagsOpen} onOpenChange={setAiFlagsOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[1400px] p-0 sm:max-w-[1400px] sm:w-[calc(100vw-2rem)]">
          <div className="flex h-[min(calc(100dvh-2rem),620px)] flex-col overflow-hidden">
            <DialogHeader className="shrink-0 border-b border-border/60 bg-background px-6 pb-4 pt-6 sm:px-7">
              <DialogTitle className="font-sans">AI flagged items</DialogTitle>
              <DialogDescription>
                Compliance flags generated by the model. These are informational and should be validated by the reviewer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[360px_1fr]">
              <div className="min-h-0 border-b border-border/60 bg-muted/10 p-3 sm:border-b-0 sm:border-r sm:p-4">
                <div className="h-full overflow-auto pr-1">
                  <div className="space-y-1">
                    {complianceFlags.map((f, idx) => {
                      const sev = recordString(f, "severity", "info");
                      const section = recordString(f, "section_key", "general").replace(/_/g, " ");
                      const msg = markdownToPlainText(recordString(f, "message", "")).trim();
                      return (
                        <button
                          key={recordString(f, "id", String(idx))}
                          type="button"
                          onClick={() => setAiFlagsActiveIndex(idx)}
                          className={cn(
                            "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            aiFlagsActiveIndex === idx
                              ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                              {sev}
                            </span>
                            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                              {section}
                            </span>
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm text-foreground">{msg || "—"}</div>
                        </button>
                      );
                    })}
                    {complianceFlags.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No AI flagged items.</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="min-h-0 bg-background p-4 sm:p-6">
                <div className="h-full overflow-auto pr-1">
                  {complianceFlags.length > 0 ? (
                    (() => {
                      const f = complianceFlags[Math.min(aiFlagsActiveIndex, complianceFlags.length - 1)];
                      const sev = recordString(f, "severity", "info");
                      const section = recordString(f, "section_key", "general").replace(/_/g, " ");
                      const msg = markdownToPlainText(recordString(f, "message", "")).trim();
                      const citation = recordString(f, "cfr_reference", "").trim();
                      const actionable = recordString(f, "actionable", "").trim();
                      return (
                        <div className="mx-auto w-full max-w-3xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {sev}
                            </span>
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {section}
                            </span>
                          </div>
                          <div className="mt-4 border-t border-border/40 pt-4">
                            <p className="text-sm leading-relaxed text-foreground">{msg || "—"}</p>
                            {citation ? (
                              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                                <span className="font-semibold text-foreground">Citation:</span> {citation}
                              </p>
                            ) : null}
                            {actionable ? (
                              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                <span className="font-semibold text-foreground">Suggestion:</span> {actionable}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="mx-auto w-full max-w-3xl">
                      <p className="text-sm text-muted-foreground">No AI flagged items.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionLetterOpen} onOpenChange={setRevisionLetterOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[1400px] p-0 sm:max-w-[1400px] sm:w-[calc(100vw-2rem)]">
          <div className="flex h-[min(calc(100dvh-2rem),620px)] flex-col overflow-hidden">
            <DialogHeader className="shrink-0 border-b border-border/60 bg-background px-6 pb-4 pt-6 sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="font-sans">Revision letter</DialogTitle>
                  <DialogDescription>
                    Draft manually or with AI. Sending records the letter for the PI in-app and sets status to{" "}
                    <strong>Revisions Requested</strong> when allowed.
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 cursor-pointer gap-2"
                    onClick={() => void draftRevisionLetter()}
                    disabled={drafting}
                  >
                    {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                    {revisionLetter.trim() ? "Regenerate" : "AI draft"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 cursor-pointer gap-2"
                    disabled={!revisionLetter.trim() || sendingLetter}
                    onClick={() => void sendRevisionLetterToPi()}
                  >
                    {sendingLetter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send to PI
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[360px_1fr]">
              <div className="min-h-0 border-b border-border/60 bg-muted/10 p-3 sm:border-b-0 sm:border-r sm:p-4">
                <div className="h-full overflow-auto pr-1">
                  <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recent letters
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 cursor-pointer text-xs"
                      onClick={() => {
                        setPendingLetterId(null);
                        setRevisionLetter("");
                        setBanner("New draft started — write, then AI draft or send when ready.");
                      }}
                    >
                      Create new draft
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {letters
                      .filter((l) => l.type === "revision")
                      .slice(0, 12)
                      .map((l) => {
                        const isActive = pendingLetterId ? l.id === pendingLetterId : false;
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => {
                              setRevisionLetter(l.content ?? "");
                              setPendingLetterId(l.id);
                            }}
                            className={cn(
                              "w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              isActive
                                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[0.7rem] font-medium text-muted-foreground">
                                {new Date(l.created_at).toLocaleString()}
                              </span>
                              <span
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                                  l.sent_at
                                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                    : "bg-muted/40 text-muted-foreground",
                                )}
                              >
                                {l.sent_at ? "Sent" : "Draft"}
                              </span>
                            </div>
                            <div className="mt-1 line-clamp-2 text-sm text-foreground">
                              {markdownToPlainText(l.content ?? "") || "—"}
                            </div>
                          </button>
                        );
                      })}
                    {letters.filter((l) => l.type === "revision").length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No revision letters yet.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="min-h-0 bg-background p-4 sm:p-6">
                <div className="h-full overflow-auto pr-1">
                  <div className="mx-auto w-full max-w-4xl">
                    {pendingLetterId ? (
                      <p className="mb-4 text-xs text-muted-foreground">
                        Editing draft letter ID{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">{pendingLetterId.slice(0, 8)}…</code>{" "}
                        — sending will update this draft.
                      </p>
                    ) : null}
                    <ProposalCanvasEditor
                      markdown={revisionLetter}
                      onMarkdownChange={(md) => setRevisionLetter(md)}
                      placeholder="Start writing here…"
                      className="px-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={approveDialogOpen}
        onOpenChange={(open) => {
          setApproveDialogOpen(open);
          if (!open) setApproveConfirmText("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans">Approve submission</DialogTitle>
            <DialogDescription>
              This action signs off on the current submission and sets status to <strong>Approved</strong>.
              Type <strong>APPROVE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="approve-confirm" className="text-sm font-medium text-foreground">
              Confirmation
            </Label>
            <Input
              id="approve-confirm"
              value={approveConfirmText}
              onChange={(e) => setApproveConfirmText(e.target.value)}
              placeholder="Type APPROVE"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => {
                  setApproveDialogOpen(false);
                  setApproveConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="cursor-pointer"
                disabled={statusUpdating || approveConfirmText.trim().toUpperCase() !== "APPROVE"}
                onClick={() => {
                  setApproveDialogOpen(false);
                  setApproveConfirmText("");
                  void updateStatus("approved");
                }}
              >
                {statusUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm & sign off
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-sans">Request revisions</DialogTitle>
            <DialogDescription>
              Sets the proposal to <strong>Revisions Requested</strong> so the PI can edit and resubmit. Use this when you
              do not need a formal letter yet, or follow up with a letter from the Revision Letter tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="rev-note" className="text-sm font-medium text-foreground">
              Optional note to the PI (posted to Messages)
            </Label>
            <Textarea
              id="rev-note"
              rows={4}
              placeholder="e.g. Please expand the consent section per our call."
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              className="min-h-[120px] resize-none rounded-md border-border/80 bg-background text-sm leading-relaxed"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevisionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer min-w-[5.5rem]"
              onClick={() => void confirmRequestRevisionsOnly()}
              disabled={statusUpdating}
            >
              {statusUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              if (node.id === "ai_flags") {
                setAiFlagsActiveIndex(0);
                setAiFlagsOpen(true);
                return;
              }
              if (node.id === "letter") {
                setRevisionLetterOpen(true);
                return;
              }
              setActiveNode(node.id);
              if (TAB_VALUES.includes(node.id as TabValue)) {
                setTab(node.id as TabValue);
              }
            }}
            showIcons={false}
            showLines={false}
          />
        </div>

        {/* Main content area */}
        <div className="min-w-0 flex-1">
          {activeNode === "summary" ? (
            <Card className="border-0 bg-transparent shadow-none hover:border-0 hover:shadow-none">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b border-border/50 pb-4">
                <div className="space-y-1">
                  <CardTitle className="font-sans text-base font-semibold tracking-tight">AI-generated summary</CardTitle>
                  <CardDescription>
                    {isStaffReviewer
                      ? "Structured triage view with risk, population, and pathway suggestions. Regenerate after the PI updates the submission."
                      : "Structured triage view for administrators. Regenerate after the PI updates the submission."}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="gap-2 cursor-pointer shrink-0"
                  onClick={() => void generateSummary()}
                  disabled={summarizing}
                >
                  {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  {summary ? "Regenerate" : "Generate summary"}
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                {complianceFlags.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mb-5 cursor-pointer"
                    onClick={() => {
                      setAiFlagsActiveIndex(0);
                      setAiFlagsOpen(true);
                    }}
                  >
                    View AI flagged items ({complianceFlags.length})
                  </Button>
                ) : null}
                {summary ? (
                  <div className="space-y-4">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {Array.from(SUMMARY_COMPACT_KEYS).map((key) => {
                        if (!(key in summary)) return null;
                        const value = summary[key];
                        return (
                          <div
                            key={key}
                            className="rounded-lg bg-muted/10 px-3 py-2.5"
                          >
                            <div className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                              {key.replace(/_/g, " ")}
                            </div>
                            <div className="mt-1 text-sm font-medium leading-snug text-foreground">
                              {renderJsonValue(value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {Object.entries(summary).some(([key]) => !SUMMARY_COMPACT_KEYS.has(key)) ? (
                      <div className="rounded-lg bg-muted/10 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">Full AI summary</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              Open in a wider view for easier scanning.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 cursor-pointer"
                            onClick={() => {
                              const first =
                                Object.entries(summary).find(([k]) => !SUMMARY_COMPACT_KEYS.has(k))?.[0] ?? null;
                              setFullSummaryActiveKey(first);
                              setFullSummaryOpen(true);
                            }}
                          >
                            Open full summary
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl bg-muted/10 px-6 py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Generate a summary to see risk level, population, methodology, and pathway suggestions for this
                      protocol.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : activeNode === "ai_flags" ? (
            <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  AI flagged items
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Items the AI flagged during compliance review. These are informational and should be validated by the reviewer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {complianceFlags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No AI flagged items.</p>
                ) : (
                  <div className="space-y-2">
                    {complianceFlags.map((f, i) => (
                      <div
                        key={recordString(f, "id", String(i))}
                        className="rounded-xl border border-border/10 bg-muted/5 px-4 py-3"
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {recordString(f, "severity", "info")} · {recordString(f, "section_key", "general")}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                          {markdownToPlainText(recordString(f, "message", ""))}
                        </p>
                        {recordString(f, "cfr_reference", "").trim() ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Reference:</span>{" "}
                            {recordString(f, "cfr_reference", "")}
                          </p>
                        ) : null}
                        {recordString(f, "actionable", "").trim() ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Suggested fix:</span>{" "}
                            {recordString(f, "actionable", "")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : activeNode === "reviewers" ? (
            <Card className="border-0 bg-transparent shadow-none hover:border-0 hover:shadow-none">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 pb-4">
                <div className="space-y-1">
                  <CardTitle className="font-sans text-base font-semibold tracking-tight">
                    Reviewer &amp; workflow hub
                  </CardTitle>
                  <CardDescription>
                    Assign reviewers, advance review status, and coordinate revision requests from one place.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer shrink-0"
                  onClick={() => setReviewerHubOpen(true)}
                >
                  Open hub
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted/10 px-3 py-2.5">
                    <div className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                      Assigned reviewers
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{assignments.length}</div>
                  </div>
                  <div className="rounded-lg bg-muted/10 px-3 py-2.5">
                    <div className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                      Submitted reviews
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{reviews.length}</div>
                  </div>
                  <div className="rounded-lg bg-muted/10 px-3 py-2.5">
                    <div className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                      Current status
                    </div>
                    <div className="mt-1 text-sm font-semibold capitalize text-foreground">
                      {proposal.status.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Use the hub to take actions; supporting materials remain in the Documents section above.
                </p>
              </CardContent>
            </Card>
          ) : activeNode === "letter" ? (
            <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b border-border/50 pb-4">
                <div className="space-y-1">
                  <CardTitle className="font-sans text-base font-semibold tracking-tight">Revision letter</CardTitle>
                  <CardDescription>
                    Draft manually or with AI. Sending records the letter for the PI in-app and sets status to{" "}
                    <strong>Revisions Requested</strong> when allowed.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="gap-2 cursor-pointer shrink-0"
                  onClick={() => void draftRevisionLetter()}
                  disabled={drafting}
                >
                  {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  AI draft
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <Textarea
                  rows={14}
                  placeholder="Write or paste the revision letter to the PI..."
                  value={revisionLetter}
                  onChange={(e) => setRevisionLetter(e.target.value)}
                  className="min-h-[280px] resize-y rounded-xl font-sans text-sm leading-relaxed"
                />
                {pendingLetterId ? (
                  <p className="text-xs text-muted-foreground">
                    Editing draft letter ID <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">{pendingLetterId.slice(0, 8)}…</code> — send
                    will update this draft.
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <Button
                    className="gap-2 cursor-pointer min-w-[180px]"
                    disabled={!revisionLetter.trim() || sendingLetter}
                    onClick={() => void sendRevisionLetterToPi()}
                  >
                    {sendingLetter ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send letter
                  </Button>
                </div>

                {letters.filter((l) => l.type === "revision").length > 0 ? (
                  <details className="group rounded-lg border border-border/60 bg-muted/10 open:bg-muted/15">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium outline-none marker:content-none [&::-webkit-details-marker]:hidden">
                      <span>
                        Recent letters (
                        {letters.filter((l) => l.type === "revision").length})
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <ul className="space-y-2 border-t border-border/40 px-4 pb-4 pt-2 text-sm">
                      {letters
                        .filter((l) => l.type === "revision")
                        .slice(0, 5)
                        .map((l) => (
                          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-muted-foreground">
                              {new Date(l.created_at).toLocaleString()}
                              {l.generated_by_ai ? " · AI draft" : " · Manual"}
                            </span>
                            <span className="text-xs font-medium text-foreground">
                              {l.sent_at ? "Sent" : "Not sent"}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </details>
                ) : null}
              </CardContent>
            </Card>
          ) : activeNode === "messages" ? (
            <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
              <CardContent className="p-0">
                <MessagesThread
                  messages={messages}
                  viewerUserId={appUserId}
                  emptyLabel="No messages yet."
                  scrollAreaClassName="h-[min(420px,50vh)] p-4"
                />
                <Separator />
                <div className="flex gap-2 p-4">
                  <Input
                    placeholder="Type a message…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!sending) void sendMessage();
                      }
                    }}
                    disabled={sending}
                    className={`rounded-md ${dashboardInputClass}`}
                  />
                  <Button
                    size="icon"
                    className="cursor-pointer shrink-0"
                    onClick={() => void sendMessage()}
                    disabled={sending}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : activeNode === "submit_review" ? (
            !isStaffReviewer ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                This section is only for assigned reviewers.
              </p>
            ) : !myReviewerAssignment ? (
              <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  You do not have a review assignment for this proposal.
                </CardContent>
              </Card>
            ) : myReviewerAssignment.status === "submitted" ? (
              <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
                <CardContent className="flex flex-col items-center py-12">
                  <div className="rounded-lg bg-primary/5 p-3 text-primary">
                    <Send className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">Review submitted</h3>
                  <p className="mt-1 text-center text-sm text-muted-foreground">
                    Thank you. Your decision and comments are on record for the IRB office.
                  </p>
                  <Button
                    type="button"
                    className="mt-6 cursor-pointer"
                    onClick={() => {
                      setTab("summary");
                      setActiveNode("summary");
                    }}
                  >
                    Back to AI Summary
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}>
                <CardHeader>
                  <CardTitle className="font-sans text-base font-semibold">Your review</CardTitle>
                  <CardDescription>
                    Submit a formal recommendation for this protocol. The IRB administrator will see your decision and
                    comments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Decision</Label>
                    <Select
                      value={reviewDecision}
                      onValueChange={(v) => setReviewDecision(v as ReviewDecision)}
                    >
                      <SelectTrigger className="rounded-md">
                        <SelectValue placeholder="Select your decision" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approve">Approve</SelectItem>
                        <SelectItem value="minor_modifications">Approve with minor modifications</SelectItem>
                        <SelectItem value="revisions_required">Revisions required</SelectItem>
                        <SelectItem value="reject">Reject</SelectItem>
                        <SelectItem value="table">Table for discussion</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Overall assessment</Label>
                    <Textarea
                      variant="lg"
                      rows={5}
                      placeholder="Summarize strengths, concerns, and whether the protocol is ready for IRB consideration."
                      value={reviewComments.overall}
                      onChange={(e) => setReviewComments((c) => ({ ...c, overall: e.target.value }))}
                      className="min-h-[8.5rem]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Methodology</Label>
                    <Textarea
                      variant="md"
                      rows={3}
                      placeholder="Comment on design, procedures, data collection, and analysis as described."
                      value={reviewComments.methodology}
                      onChange={(e) => setReviewComments((c) => ({ ...c, methodology: e.target.value }))}
                      className="min-h-[5rem]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Ethical considerations</Label>
                    <Textarea
                      variant="md"
                      rows={3}
                      placeholder="Note consent, vulnerable populations, privacy, and any ethical gaps."
                      value={reviewComments.ethics}
                      onChange={(e) => setReviewComments((c) => ({ ...c, ethics: e.target.value }))}
                      className="min-h-[5rem]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Risk assessment</Label>
                    <Textarea
                      variant="md"
                      rows={3}
                      placeholder="Describe risks to participants and whether safeguards are adequate."
                      value={reviewComments.risk_assessment}
                      onChange={(e) => setReviewComments((c) => ({ ...c, risk_assessment: e.target.value }))}
                      className="min-h-[5rem]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Recommendations</Label>
                    <Textarea
                      variant="md"
                      rows={3}
                      placeholder="List concrete changes, clarifications, or conditions before approval."
                      value={reviewComments.recommendations}
                      onChange={(e) => setReviewComments((c) => ({ ...c, recommendations: e.target.value }))}
                      className="min-h-[5rem]"
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-9 w-full cursor-pointer gap-2 rounded-md sm:w-auto"
                    onClick={() => void handleSubmitReviewerForm()}
                    disabled={!reviewDecision || reviewSubmitting}
                  >
                    {reviewSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit review
                  </Button>
                </CardContent>
              </Card>
            )
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
                    <CardHeader className="border-b border-border/40 pb-4">
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
    </div>
  );
}

export default function AdminProposalDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AdminProposalDetailInner />
    </Suspense>
  );
}
