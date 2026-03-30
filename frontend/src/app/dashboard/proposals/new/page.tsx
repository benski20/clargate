"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Upload,
  Sparkles,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { dashboardCardClass, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { db } from "@/lib/database";
import { streamEdgeFunction } from "@/lib/edge-functions";
import type { Proposal } from "@/lib/types";

const STEPS = [
  "Study Information",
  "Research Team",
  "Participant Population",
  "Recruitment",
  "Data Collection",
  "Risk Assessment",
  "Supporting Documents",
  "Review & Submit",
];

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export default function NewProposalPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Record<string, unknown>>({
    study_info: { title: "", review_type: "", description: "", objectives: "" },
    research_team: { pi_name: "", co_investigators: "", department: "" },
    participants: { population: "", age_range: "", sample_size: "", vulnerable: "" },
    recruitment: { methods: "", materials: "", compensation: "" },
    data_collection: { methods: "", data_types: "", storage: "", duration: "" },
    risk_assessment: { risks: "", benefits: "", mitigation: "", consent_process: "" },
  });

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);

  function updateSection(section: string, field: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as Record<string, string>), [field]: value },
    }));
  }

  const autoSave = useCallback(
    async (data: Record<string, unknown>) => {
      setSaving(true);
      try {
        const title =
          ((data.study_info as Record<string, string>)?.title as string) || "Untitled Proposal";
        if (!proposalId) {
          const created = await db.createProposal(title, data);
          setProposalId(created.id);
        } else {
          await db.updateProposal(proposalId, { title, form_data: data });
        }
      } catch {
      } finally {
        setSaving(false);
      }
    },
    [proposalId],
  );

  async function handleSubmit() {
    setSubmitting(true);
    try {
      let id = proposalId;
      if (!id) {
        const title =
          ((formData.study_info as Record<string, string>)?.title as string) || "Untitled Proposal";
        const created = await db.createProposal(title, formData);
        id = created.id as string;
        setProposalId(id);
      }
      const reviewType = (formData.study_info as Record<string, string>)?.review_type || null;
      await db.updateProposal(id, {
        title: (formData.study_info as Record<string, string>)?.title,
        review_type: reviewType || undefined,
        form_data: formData,
      });
      await db.submitProposal(id);
      router.replace(`/dashboard/proposals/${id}`);
      router.refresh();
    } catch {
      setSubmitting(false);
    }
  }

  async function askAssistant() {
    if (!assistantInput.trim()) return;
    const question = assistantInput;
    setAssistantInput("");
    setAssistantMessages((prev) => [...prev, { role: "user", content: question }]);
    setAssistantLoading(true);

    try {
      const stream = await streamEdgeFunction("pi-assistant", {
        proposal_id: proposalId,
        question,
        section_context: STEPS[step],
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let content = "";

      setAssistantMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            content += line.slice(6);
            setAssistantMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content };
              return updated;
            });
          }
        }
      }
    } catch {
      setAssistantMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that request." },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="font-[var(--font-heading)] text-2xl font-medium tracking-tight">New Proposal</h1>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
        </div>
        {saving && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving...
          </span>
        )}
      </div>

      <Progress value={progress} className="h-2 rounded-full" />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className={dashboardCardClass}>
          <CardContent className="pt-6">
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Study Title</Label>
                  <Input
                    placeholder="Enter your study title"
                    value={(formData.study_info as Record<string, string>)?.title || ""}
                    onChange={(e) => updateSection("study_info", "title", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Review Type</Label>
                  <Select
                    value={(formData.study_info as Record<string, string>)?.review_type || ""}
                    onValueChange={(v) => updateSection("study_info", "review_type", v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select review type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exempt">Exempt</SelectItem>
                      <SelectItem value="expedited">Expedited</SelectItem>
                      <SelectItem value="full_board">Full Board</SelectItem>
                      <SelectItem value="not_sure">Not Sure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Study Description</Label>
                  <Textarea
                    rows={4}
                    placeholder="Provide a brief description of your study"
                    value={(formData.study_info as Record<string, string>)?.description || ""}
                    onChange={(e) => updateSection("study_info", "description", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Research Objectives</Label>
                  <Textarea
                    rows={3}
                    placeholder="List the primary objectives of your research"
                    value={(formData.study_info as Record<string, string>)?.objectives || ""}
                    onChange={(e) => updateSection("study_info", "objectives", e.target.value)}
                  />
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Principal Investigator</Label>
                  <Input
                    placeholder="Full name and credentials"
                    value={(formData.research_team as Record<string, string>)?.pi_name || ""}
                    onChange={(e) => updateSection("research_team", "pi_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Co-Investigators</Label>
                  <Textarea
                    rows={3}
                    placeholder="List co-investigators (one per line)"
                    value={(formData.research_team as Record<string, string>)?.co_investigators || ""}
                    onChange={(e) => updateSection("research_team", "co_investigators", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    placeholder="Department / Faculty"
                    value={(formData.research_team as Record<string, string>)?.department || ""}
                    onChange={(e) => updateSection("research_team", "department", e.target.value)}
                  />
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Study Population</Label>
                  <Textarea
                    rows={3}
                    placeholder="Describe your target participant population"
                    value={(formData.participants as Record<string, string>)?.population || ""}
                    onChange={(e) => updateSection("participants", "population", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age Range</Label>
                  <Input
                    placeholder="e.g., 18-65 years"
                    value={(formData.participants as Record<string, string>)?.age_range || ""}
                    onChange={(e) => updateSection("participants", "age_range", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Sample Size</Label>
                  <Input
                    placeholder="e.g., 200 participants"
                    value={(formData.participants as Record<string, string>)?.sample_size || ""}
                    onChange={(e) => updateSection("participants", "sample_size", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vulnerable Populations</Label>
                  <Textarea
                    rows={2}
                    placeholder="List any vulnerable populations (children, prisoners, etc.) or write 'None'"
                    value={(formData.participants as Record<string, string>)?.vulnerable || ""}
                    onChange={(e) => updateSection("participants", "vulnerable", e.target.value)}
                  />
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Recruitment Methods</Label>
                  <Textarea
                    rows={3}
                    placeholder="Describe how participants will be recruited"
                    value={(formData.recruitment as Record<string, string>)?.methods || ""}
                    onChange={(e) => updateSection("recruitment", "methods", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Recruitment Materials</Label>
                  <Textarea
                    rows={2}
                    placeholder="List flyers, emails, scripts, or other materials"
                    value={(formData.recruitment as Record<string, string>)?.materials || ""}
                    onChange={(e) => updateSection("recruitment", "materials", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Compensation</Label>
                  <Input
                    placeholder="e.g., $25 gift card or None"
                    value={(formData.recruitment as Record<string, string>)?.compensation || ""}
                    onChange={(e) => updateSection("recruitment", "compensation", e.target.value)}
                  />
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Data Collection Methods</Label>
                  <Textarea
                    rows={3}
                    placeholder="Surveys, interviews, observations, biological samples, etc."
                    value={(formData.data_collection as Record<string, string>)?.methods || ""}
                    onChange={(e) => updateSection("data_collection", "methods", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Types of Data Collected</Label>
                  <Textarea
                    rows={2}
                    placeholder="Identifiable data, de-identified data, PHI, etc."
                    value={(formData.data_collection as Record<string, string>)?.data_types || ""}
                    onChange={(e) => updateSection("data_collection", "data_types", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Storage & Security</Label>
                  <Textarea
                    rows={2}
                    placeholder="Where and how data will be stored, encrypted, and protected"
                    value={(formData.data_collection as Record<string, string>)?.storage || ""}
                    onChange={(e) => updateSection("data_collection", "storage", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Study Duration</Label>
                  <Input
                    placeholder="e.g., 12 months"
                    value={(formData.data_collection as Record<string, string>)?.duration || ""}
                    onChange={(e) => updateSection("data_collection", "duration", e.target.value)}
                  />
                </div>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Potential Risks</Label>
                  <Textarea
                    rows={3}
                    placeholder="Describe potential risks to participants (physical, psychological, social, economic)"
                    value={(formData.risk_assessment as Record<string, string>)?.risks || ""}
                    onChange={(e) => updateSection("risk_assessment", "risks", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Potential Benefits</Label>
                  <Textarea
                    rows={3}
                    placeholder="Describe potential benefits to participants and/or society"
                    value={(formData.risk_assessment as Record<string, string>)?.benefits || ""}
                    onChange={(e) => updateSection("risk_assessment", "benefits", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Risk Mitigation</Label>
                  <Textarea
                    rows={2}
                    placeholder="How will risks be minimized?"
                    value={(formData.risk_assessment as Record<string, string>)?.mitigation || ""}
                    onChange={(e) => updateSection("risk_assessment", "mitigation", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Informed Consent Process</Label>
                  <Textarea
                    rows={3}
                    placeholder="Describe how informed consent will be obtained"
                    value={(formData.risk_assessment as Record<string, string>)?.consent_process || ""}
                    onChange={(e) => updateSection("risk_assessment", "consent_process", e.target.value)}
                  />
                </div>
              </div>
            )}
            {step === 6 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload supporting documents: CITI certificates, consent forms, recruitment
                  materials, survey instruments, and any other relevant files.
                </p>
                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-border p-12 text-center">
                  <div>
                    <Upload className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-3 text-sm font-medium text-foreground">
                      Drag & drop files here
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PDF, DOC, DOCX, JPG, PNG (max 25 MB each)
                    </p>
                    <Button variant="outline" className="mt-4 cursor-pointer" size="sm">
                      Browse Files
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {step === 7 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Review your proposal before submitting. You can go back to any section to make
                  changes.
                </p>
                {Object.entries(formData).map(([section, data]) => (
                  <div key={section} className="rounded-lg border border-border p-4">
                    <h4 className="mb-2 text-sm font-semibold capitalize text-foreground">
                      {section.replace(/_/g, " ")}
                    </h4>
                    {Object.entries(data as Record<string, string>).map(([key, value]) =>
                      value ? (
                        <p key={key} className="text-sm text-muted-foreground">
                          <span className="font-medium capitalize text-foreground">
                            {key.replace(/_/g, " ")}:
                          </span>{" "}
                          {value}
                        </p>
                      ) : null
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setStep((s) => Math.max(0, s - 1));
                  autoSave(formData);
                }}
                disabled={step === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {step < STEPS.length - 1 ? (
                <Button
                  className="cursor-pointer"
                  onClick={() => {
                    setStep((s) => s + 1);
                    autoSave(formData);
                  }}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="gap-2 cursor-pointer"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Submit Proposal
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="hidden lg:block">
          <Card className={`${dashboardCardClass} sticky top-8`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-foreground" />
                AI Assistant
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] p-4">
                {assistantMessages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Ask me anything about your IRB submission. I can help with
                    regulations, best practices, and section-specific guidance.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {assistantMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`rounded-2xl p-3 text-sm ${
                          msg.role === "user"
                            ? "ml-4 bg-muted text-foreground"
                            : "mr-4 bg-muted/70 text-foreground"
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <Separator />
              <div className="flex gap-2 p-3">
                <Input
                  placeholder="Ask a question..."
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !assistantLoading && askAssistant()}
                  disabled={assistantLoading}
                  className={`text-sm ${dashboardInputClass} rounded-full`}
                />
                <Button
                  size="icon"
                  className="shrink-0 cursor-pointer"
                  onClick={askAssistant}
                  disabled={assistantLoading}
                >
                  {assistantLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
