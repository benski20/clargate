"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  Send,
  UserPlus,
  FileEdit,
  CheckCircle2,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/lib/api";
import type {
  ProposalDetail,
  ProposalStatus,
  Review,
  ReviewAssignment,
  Message,
  User,
} from "@/lib/types";

export default function AdminProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params.id as string;

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [revisionLetter, setRevisionLetter] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<ProposalDetail>(`/proposals/${proposalId}`),
      api.get<Review[]>(`/proposals/${proposalId}/reviews`).catch(() => []),
      api.get<Message[]>(`/proposals/${proposalId}/messages`).catch(() => []),
      api.get<User[]>("/institution/users").catch(() => []),
    ])
      .then(([p, r, m, u]) => {
        setProposal(p);
        setReviews(r);
        setMessages(m);
        setUsers(u);
      })
      .finally(() => setLoading(false));
  }, [proposalId]);

  async function generateSummary() {
    setSummarizing(true);
    try {
      const res = await api.post<{ summary: Record<string, unknown> }>(
        `/proposals/${proposalId}/summarize`
      );
      setSummary(res.summary);
    } catch {
    } finally {
      setSummarizing(false);
    }
  }

  async function draftRevisionLetter() {
    setDrafting(true);
    try {
      const res = await api.post<{ content: string }>(
        `/proposals/${proposalId}/draft-revision-letter`,
        {}
      );
      setRevisionLetter(res.content);
    } catch {
    } finally {
      setDrafting(false);
    }
  }

  async function updateStatus(newStatus: ProposalStatus) {
    setStatusUpdating(true);
    try {
      const updated = await api.patch<ProposalDetail>(`/proposals/${proposalId}/status`, {
        status: newStatus,
      });
      setProposal((prev) => prev && { ...prev, status: updated.status });
    } catch {
    } finally {
      setStatusUpdating(false);
    }
  }

  async function assignReviewer() {
    if (!selectedReviewer) return;
    try {
      await api.post(`/proposals/${proposalId}/assign`, {
        reviewer_user_ids: [selectedReviewer],
      });
      setSelectedReviewer("");
    } catch {}
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;
    try {
      const msg = await api.post<Message>(`/proposals/${proposalId}/messages`, {
        body: newMessage,
      });
      setMessages((prev) => [...prev, msg]);
      setNewMessage("");
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) return <p className="text-muted-foreground">Proposal not found.</p>;

  const reviewers = users.filter((u) => u.role === "reviewer");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-1 cursor-pointer" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-[var(--font-heading)] text-2xl font-bold">{proposal.title}</h1>
            <StatusBadge status={proposal.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            PI: {proposal.pi_name || "—"} &middot; Type: {proposal.review_type?.replace(/_/g, " ") || "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {proposal.status === "submitted" && (
          <Button size="sm" className="cursor-pointer" onClick={() => updateStatus("initial_review")} disabled={statusUpdating}>
            Begin Review
          </Button>
        )}
        {proposal.status === "initial_review" && (
          <>
            <Button size="sm" className="cursor-pointer" onClick={() => updateStatus("under_committee_review")} disabled={statusUpdating}>
              Send to Committee
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => updateStatus("revisions_requested")} disabled={statusUpdating}>
              Request Revisions
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => updateStatus("approved")} disabled={statusUpdating}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
            </Button>
          </>
        )}
        {proposal.status === "under_committee_review" && (
          <>
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => updateStatus("revisions_requested")} disabled={statusUpdating}>
              Request Revisions
            </Button>
            <Button size="sm" variant="outline" className="cursor-pointer bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => updateStatus("approved")} disabled={statusUpdating}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
            </Button>
          </>
        )}
        {proposal.status === "resubmitted" && (
          <Button size="sm" className="cursor-pointer" onClick={() => updateStatus("initial_review")} disabled={statusUpdating}>
            Begin Re-Review
          </Button>
        )}
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary" className="cursor-pointer"><Brain className="mr-2 h-4 w-4" />AI Summary</TabsTrigger>
          <TabsTrigger value="details" className="cursor-pointer">Details</TabsTrigger>
          <TabsTrigger value="reviewers" className="cursor-pointer"><UserPlus className="mr-2 h-4 w-4" />Reviewers</TabsTrigger>
          <TabsTrigger value="letter" className="cursor-pointer"><FileEdit className="mr-2 h-4 w-4" />Revision Letter</TabsTrigger>
          <TabsTrigger value="messages" className="cursor-pointer"><MessageSquare className="mr-2 h-4 w-4" />Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">AI-Generated Summary</CardTitle>
              <Button size="sm" className="gap-2 cursor-pointer" onClick={generateSummary} disabled={summarizing}>
                {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                {summary ? "Regenerate" : "Generate Summary"}
              </Button>
            </CardHeader>
            <CardContent>
              {summary ? (
                <div className="space-y-3">
                  {Object.entries(summary).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-sm font-medium capitalize text-foreground">{key.replace(/_/g, " ")}:</span>{" "}
                      <span className="text-sm text-muted-foreground">
                        {Array.isArray(value) ? (value as string[]).join(", ") : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click &quot;Generate Summary&quot; to create an AI-powered analysis of this proposal.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-6">
          <div className="grid gap-4">
            {proposal.form_data && Object.entries(proposal.form_data).map(([section, data]) => (
              <Card key={section}>
                <CardHeader className="pb-3"><CardTitle className="text-base capitalize">{section.replace(/_/g, " ")}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(data as Record<string, string>).map(([key, value]) => value && (
                    <div key={key}>
                      <span className="text-sm font-medium capitalize text-foreground">{key.replace(/_/g, " ")}:</span>{" "}
                      <span className="text-sm text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reviewers" className="mt-6 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Assign Reviewer</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Select value={selectedReviewer} onValueChange={(v) => setSelectedReviewer(v ?? "")}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select a reviewer" /></SelectTrigger>
                  <SelectContent>
                    {reviewers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.full_name} ({r.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="cursor-pointer" onClick={assignReviewer} disabled={!selectedReviewer}>
                  <UserPlus className="mr-2 h-4 w-4" /> Assign
                </Button>
              </div>
            </CardContent>
          </Card>
          {reviews.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Submitted Reviews</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold capitalize">{r.decision.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.submitted_at).toLocaleDateString()}</span>
                    </div>
                    {r.comments && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {Object.entries(r.comments).map(([k, v]) => (
                          <p key={k}><strong className="capitalize">{k.replace(/_/g, " ")}:</strong> {String(v)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="letter" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Revision Letter</CardTitle>
              <Button size="sm" className="gap-2 cursor-pointer" onClick={draftRevisionLetter} disabled={drafting}>
                {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                AI Draft
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={12}
                placeholder="Write or AI-draft a revision letter..."
                value={revisionLetter}
                onChange={(e) => setRevisionLetter(e.target.value)}
              />
              <Button className="mt-4 gap-2 cursor-pointer" disabled={!revisionLetter.trim()}>
                <Send className="h-4 w-4" /> Send Letter
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[350px] p-4">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className="rounded-lg bg-muted/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{msg.sender_name || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</span>
                        </div>
                        <p className="mt-1 text-sm">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <Separator />
              <div className="flex gap-2 p-4">
                <Input placeholder="Type a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
                <Button size="icon" className="cursor-pointer" onClick={sendMessage}><Send className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
