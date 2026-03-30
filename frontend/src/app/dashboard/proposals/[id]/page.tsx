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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function ProposalDetailInner() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const proposalId = params.id as string;
  const justSubmitted = searchParams.get("submitted") === "1";
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "documents" || tabParam === "messages" || tabParam === "details"
      ? tabParam
      : "details";

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.getProposal(proposalId),
      db.getMessages(proposalId),
    ])
      .then(([p, m]) => {
        setProposal(p as ProposalDetail);
        setMessages(m as Message[]);
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

      <Tabs defaultValue={initialTab}>
        <TabsList className="h-auto rounded-2xl border border-border/80 bg-muted/50 p-1">
          <TabsTrigger value="details" className="cursor-pointer rounded-xl">
            <FileText className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="cursor-pointer rounded-xl">
            <Download className="mr-2 h-4 w-4" />
            Documents
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
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        onClick={downloadSubmissionSnapshot}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                  {proposal.documents.map((doc) => (
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
                      <Button variant="ghost" size="sm" className="cursor-pointer">
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
