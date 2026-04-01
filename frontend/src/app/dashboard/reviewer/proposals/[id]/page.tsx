"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
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
import { dashboardCardClass } from "@/components/dashboard/dashboard-ui";
import { TreeView } from "@/components/ui/tree-view";
import { db } from "@/lib/database";
import type { ProposalDetail, ReviewDecision } from "@/lib/types";
import { cn } from "@/lib/utils";

const HIDDEN_FORM_SECTIONS = new Set(["ai_workspace", "submission_snapshot", "entry_mode"]);

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

  const [activeNode, setActiveNode] = useState<string | null>(null);

  const validFormSections = proposal?.form_data
    ? Object.entries(proposal.form_data).filter(
        ([section, data]) =>
          !HIDDEN_FORM_SECTIONS.has(section) &&
          data !== null &&
          typeof data === "object" &&
          !Array.isArray(data),
      )
    : [];

  useEffect(() => {
    if (!activeNode && proposal) {
      if (validFormSections.length > 0) {
        setActiveNode(validFormSections[0][0]);
      } else {
        setActiveNode("review");
      }
    }
  }, [validFormSections, activeNode, proposal]);

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

  const treeData = [
    {
      id: "proposal-group",
      label: "Proposal",
      children: validFormSections.map(([section]) => ({
        id: section,
        label: section.replace(/_/g, " "),
      })),
    },
    {
      id: "review",
      label: "Submit Review",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-1 cursor-pointer" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-2xl">{proposal.title}</h1>
            <StatusBadge status={proposal.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            PI: {proposal.pi_name || "—"} &middot; Type: {proposal.review_type?.replace(/_/g, " ") || "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Sidebar navigation */}
        <div className="w-full shrink-0 md:w-64">
          <TreeView
            className="border-none bg-transparent p-0"
            data={treeData}
            defaultExpandedIds={["proposal-group"]}
            selectedIds={activeNode ? [activeNode] : []}
            onNodeClick={(node) => {
              if (node.children) return;
              setActiveNode(node.id);
            }}
            showIcons={false}
            showLines={false}
          />
        </div>

        {/* Main content area */}
        <div className="min-w-0 flex-1">
          {activeNode === "review" ? (
            submitted ? (
              <Card className={dashboardCardClass}>
                <CardContent className="flex flex-col items-center py-12">
                  <div className="rounded-lg bg-primary/5 p-3 text-primary">
                    <Send className="h-6 w-6 text-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">Review Submitted</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Thank you for your review. The admin will be notified.
                  </p>
                  <Button
                    className="mt-6 cursor-pointer"
                    onClick={() => {
                      router.replace("/dashboard/reviewer");
                      router.refresh();
                    }}
                  >
                    Back to Reviews
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className={dashboardCardClass}>
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
                    className="h-9 w-full cursor-pointer gap-2 rounded-md bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                    onClick={handleSubmitReview}
                    disabled={!decision || submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit Review
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
                  <Card className={dashboardCardClass} key={section}>
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
