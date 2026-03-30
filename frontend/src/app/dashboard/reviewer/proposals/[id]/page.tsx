"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Brain, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { db } from "@/lib/database";
import type { ProposalDetail, ReviewDecision } from "@/lib/types";

export default function ReviewerProposalPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params.id as string;

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [decision, setDecision] = useState<ReviewDecision | "">("");
  const [comments, setComments] = useState({
    overall: "",
    methodology: "",
    ethics: "",
    risk_assessment: "",
    recommendations: "",
  });

  useEffect(() => {
    db.getProposal(proposalId)
      .then((p) => setProposal(p as ProposalDetail))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proposalId]);

  async function handleSubmitReview() {
    if (!decision) return;
    setSubmitting(true);
    try {
      const assignments = await db.getMyAssignments();
      const assignment = assignments.find(
        (a: Record<string, unknown>) => a.proposal_id === proposalId,
      );
      if (!assignment) return;

      await db.submitReview(assignment.id as string, decision, comments);
      setSubmitted(true);
    } catch {
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) return <p className="text-muted-foreground">Proposal not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-1 cursor-pointer" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-[var(--font-heading)] text-2xl font-bold">{proposal.title}</h1>
            <StatusBadge status={proposal.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            PI: {proposal.pi_name || "—"} &middot; Type: {proposal.review_type?.replace(/_/g, " ") || "—"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="proposal">
        <TabsList>
          <TabsTrigger value="proposal" className="cursor-pointer">Proposal</TabsTrigger>
          <TabsTrigger value="review" className="cursor-pointer">Submit Review</TabsTrigger>
        </TabsList>

        <TabsContent value="proposal" className="mt-6">
          <div className="grid gap-4">
            {proposal.form_data && Object.entries(proposal.form_data).map(([section, data]) => (
              <Card key={section}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base capitalize">{section.replace(/_/g, " ")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(data as Record<string, string>).map(([key, value]) =>
                    value ? (
                      <div key={key}>
                        <span className="text-sm font-medium capitalize text-foreground">{key.replace(/_/g, " ")}:</span>{" "}
                        <span className="text-sm text-muted-foreground">{value}</span>
                      </div>
                    ) : null
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="review" className="mt-6">
          {submitted ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <div className="rounded-full bg-emerald-100 p-3">
                  <Send className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Review Submitted</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Thank you for your review. The admin will be notified.
                </p>
                <Button className="mt-6 cursor-pointer" onClick={() => router.push("/dashboard/reviewer")}>
                  Back to Reviews
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Your Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Decision</Label>
                  <Select value={decision} onValueChange={(v) => setDecision(v as ReviewDecision)}>
                    <SelectTrigger><SelectValue placeholder="Select your decision" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approve">Approve</SelectItem>
                      <SelectItem value="minor_modifications">Approve with Minor Modifications</SelectItem>
                      <SelectItem value="revisions_required">Revisions Required</SelectItem>
                      <SelectItem value="reject">Reject</SelectItem>
                      <SelectItem value="table">Table for Discussion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Overall Assessment</Label>
                  <Textarea
                    rows={3}
                    placeholder="Provide your overall assessment of this proposal"
                    value={comments.overall}
                    onChange={(e) => setComments((c) => ({ ...c, overall: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Methodology Review</Label>
                  <Textarea
                    rows={2}
                    placeholder="Comments on the research methodology"
                    value={comments.methodology}
                    onChange={(e) => setComments((c) => ({ ...c, methodology: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ethical Considerations</Label>
                  <Textarea
                    rows={2}
                    placeholder="Comments on ethical aspects"
                    value={comments.ethics}
                    onChange={(e) => setComments((c) => ({ ...c, ethics: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Risk Assessment Review</Label>
                  <Textarea
                    rows={2}
                    placeholder="Comments on the risk-benefit analysis"
                    value={comments.risk_assessment}
                    onChange={(e) => setComments((c) => ({ ...c, risk_assessment: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Recommendations</Label>
                  <Textarea
                    rows={2}
                    placeholder="Specific recommendations or required changes"
                    value={comments.recommendations}
                    onChange={(e) => setComments((c) => ({ ...c, recommendations: e.target.value }))}
                  />
                </div>

                <Button
                  className="w-full gap-2 cursor-pointer"
                  onClick={handleSubmitReview}
                  disabled={!decision || submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit Review
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
