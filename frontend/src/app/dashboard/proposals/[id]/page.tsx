"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
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
import { db } from "@/lib/database";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import type { ProposalDetail, Message, Letter } from "@/lib/types";

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params.id as string;

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
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
    try {
      const updated = await db.resubmitProposal(proposalId);
      setProposal((prev) => prev && { ...prev, status: updated.status });
    } catch {}
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

  return (
    <div className="space-y-6">
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
            {proposal.document_count} document{proposal.document_count !== 1 ? "s" : ""}
          </p>
        </div>
        {proposal.status === "revisions_requested" && (
          <Button className="gap-2 cursor-pointer" onClick={handleResubmit}>
            <RefreshCw className="h-4 w-4" />
            Resubmit
          </Button>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" className="cursor-pointer">
            <FileText className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="cursor-pointer">
            <Download className="mr-2 h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="messages" className="cursor-pointer">
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <div className="grid gap-4">
            {proposal.form_data &&
              Object.entries(proposal.form_data).map(([section, data]) => (
                <Card key={section}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base capitalize">
                      {section.replace(/_/g, " ")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(data as Record<string, string>).map(
                      ([key, value]) =>
                        value && (
                          <div key={key}>
                            <span className="text-sm font-medium capitalize text-foreground">
                              {key.replace(/_/g, " ")}:
                            </span>{" "}
                            <span className="text-sm text-muted-foreground">{value}</span>
                          </div>
                        )
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {proposal.documents.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No documents uploaded yet.
                </p>
              ) : (
                <div className="space-y-2">
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
          <Card>
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
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
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
