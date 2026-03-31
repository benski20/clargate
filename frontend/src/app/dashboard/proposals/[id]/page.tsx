"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  MessageSquare,
  Send,
  Download,
  RefreshCw,
  Loader2,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { dashboardCardClass, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { db } from "@/lib/database";
import { getSubmissionSnapshot } from "@/lib/submission-snapshot";
import type { ProposalDetail, Message, Letter } from "@/lib/types";

const HIDDEN_FORM_SECTIONS = new Set(["ai_workspace", "submission_snapshot", "entry_mode"]);

const PI_TABS = ["details", "documents", "letters", "messages"] as const;
type PiTab = (typeof PI_TABS)[number];

function ProposalDetailInner() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const proposalId = params.id as string;
  const justSubmitted = searchParams.get("submitted") === "1";
  const tabParam = searchParams.get("tab");
  const activeTab: PiTab = PI_TABS.includes(tabParam as PiTab) ? (tabParam as PiTab) : "details";

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  function setTab(next: PiTab) {
    const q = new URLSearchParams(searchParams.toString());
    q.set("tab", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  useEffect(() => {
    Promise.all([
      db.getProposal(proposalId),
      db.getMessages(proposalId),
      db.getProposalLetters(proposalId).catch(() => []),
    ])
      .then(([p, m, letterRows]) => {
        setProposal(p as ProposalDetail);
        setMessages(m as Message[]);
        setLetters(letterRows as Letter[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proposalId]);

  useEffect(() => {
    if (!justSubmitted) return;
    const t = setTimeout(() => {
      router.replace(pathname, { scroll: false });
    }, 10000);
    return () => clearTimeout(t);
  }, [justSubmitted, pathname, router]);

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

  async function handleResubmit() {
    setResubmitting(true);
    try {
      const updated = await db.resubmitProposal(proposalId);
      setProposal((prev) => prev && { ...prev, status: updated.status });
    } catch {
    } finally {
      setResubmitting(false);
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

  const sentRevisionLetters = letters
    .filter((l) => l.type === "revision" && l.sent_at)
    .sort((a, b) => new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime());

  const docxDocument =
    submissionSnapshot?.docx_file_name && proposal.documents?.length
      ? proposal.documents.find((d) => d.file_name === submissionSnapshot.docx_file_name)
      : undefined;

  function downloadSubmissionSnapshot() {
    if (!submissionSnapshot) return;
    const blob = new Blob([submissionSnapshot.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = submissionSnapshot.file_name;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          className="flex gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm dark:bg-emerald-950/40"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div>
            <p className="font-medium text-emerald-950 dark:text-emerald-100">Proposal submitted</p>
            <p className="mt-1 text-muted-foreground">
              Your Markdown package is listed under the Documents tab. The IRB team will review your
              materials; use Messages to ask questions or share updates.
            </p>
          </div>
        </div>
      ) : null}

      {proposal.status === "revisions_requested" && sentRevisionLetters.length > 0 ? (
        <div
          className="flex flex-col gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:bg-amber-950/30"
          role="status"
        >
          <div>
            <p className="font-medium text-amber-950 dark:text-amber-100">Revisions requested</p>
            <p className="mt-1 text-muted-foreground">
              Your IRB office sent formal feedback. Review it in the IRB feedback tab, then address the
              items and resubmit when ready.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 cursor-pointer"
            onClick={() => setTab("letters")}
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
            <h1 className="font-[var(--font-heading)] text-2xl font-bold">{proposal.title}</h1>
            <StatusBadge status={proposal.status} />
          </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Submitted {proposal.submitted_at ? new Date(proposal.submitted_at).toLocaleDateString() : "—"} &middot;{" "}
              {proposal.document_count + (submissionSnapshot ? 1 : 0)} document
              {proposal.document_count + (submissionSnapshot ? 1 : 0) !== 1 ? "s" : ""}
            </p>
        </div>
        {proposal.status === "revisions_requested" && (
          <Button
            className="gap-2 cursor-pointer"
            onClick={handleResubmit}
            disabled={resubmitting}
          >
            {resubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Resubmit
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setTab(v as PiTab)}>
        <TabsList className="h-auto flex-wrap rounded-2xl border border-border/80 bg-muted/50 p-1">
          <TabsTrigger value="details" className="cursor-pointer rounded-xl">
            <FileText className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="cursor-pointer rounded-xl">
            <Download className="mr-2 h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="letters" className="cursor-pointer rounded-xl">
            <ScrollText className="mr-2 h-4 w-4" />
            IRB feedback
            {sentRevisionLetters.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums">
                {sentRevisionLetters.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="messages" className="cursor-pointer rounded-xl">
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <div className="grid gap-4">
            {proposal.form_data &&
              Object.entries(proposal.form_data)
                .filter(
                  ([section, data]) =>
                    !HIDDEN_FORM_SECTIONS.has(section) &&
                    data !== null &&
                    typeof data === "object" &&
                    !Array.isArray(data),
                )
                .map(([section, data]) => (
                  <Card className={dashboardCardClass} key={section}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base capitalize">
                        {section.replace(/_/g, " ")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(data as Record<string, string>).map(
                        ([key, value]) =>
                          value &&
                          typeof value === "string" && (
                            <div key={key}>
                              <span className="text-sm font-medium capitalize text-foreground">
                                {key.replace(/_/g, " ")}:
                              </span>{" "}
                              <span className="text-sm text-muted-foreground">{value}</span>
                            </div>
                          ),
                      )}
                    </CardContent>
                  </Card>
                ))}
          </div>
        </TabsContent>

        <TabsContent value="letters" className="mt-6">
          <Card className={dashboardCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="font-sans text-base font-semibold">IRB feedback</CardTitle>
              <CardDescription>
                Formal revision letters from your IRB office. Status also appears in the header (
                <strong>Revisions requested</strong>).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {sentRevisionLetters.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                  No formal letters have been sent yet. When your office requests revisions, the letter will
                  appear here and you will receive an email if your institution has mail enabled.
                </p>
              ) : (
                sentRevisionLetters.map((letter) => (
                  <div
                    key={letter.id}
                    className="rounded-2xl border border-border/80 bg-muted/10 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Revision letter
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Sent{" "}
                        {letter.sent_at
                          ? new Date(letter.sent_at).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                      {letter.content}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card className={dashboardCardClass}>
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
                          <p className="text-sm font-medium">{submissionSnapshot.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Submitted package (database) ·{" "}
                            {new Date(submissionSnapshot.submitted_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={downloadSubmissionSnapshot}
                        >
                          <Download className="mr-1.5 h-4 w-4" />
                          Markdown
                        </Button>
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
                  {proposal.documents
                    .filter((doc) => {
                      if (docxDocument && doc.id === docxDocument.id) return false;
                      if (
                        submissionSnapshot &&
                        doc.file_name === submissionSnapshot.file_name
                      ) {
                        return false;
                      }
                      return true;
                    })
                    .map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
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
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <Card className={dashboardCardClass}>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] p-4">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No messages yet. Start a conversation with the IRB office.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className="rounded-lg bg-muted/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {msg.sender_name || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-foreground">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <Separator />
              <div className="flex gap-2 p-4">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !sending && sendMessage()}
                  disabled={sending}
                  className={`rounded-full ${dashboardInputClass}`}
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
        </TabsContent>
      </Tabs>
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
