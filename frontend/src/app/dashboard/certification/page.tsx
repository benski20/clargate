"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FileImage,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dashboardCardClass } from "@/components/dashboard/dashboard-ui";
import {
  COMPLIANCE_CERTIFICATION_ACCEPT,
  COMPLIANCE_CERTIFICATION_MAX_BYTES,
  COMPLIANCE_CERTIFICATION_TYPES,
  complianceCertificationTypeLabel,
} from "@/lib/compliance-certifications";
import { db } from "@/lib/database";
import type {
  CertificationExtractedMetadata,
  ComplianceCertification,
  ComplianceCertificationType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type WizardStep = "upload" | "review";

const WIZARD_STEPS: { id: WizardStep; label: string; short: string }[] = [
  { id: "upload", label: "Upload", short: "Upload certificate" },
  { id: "review", label: "Review", short: "Confirm details" },
];

function formatBytes(n: number | null): string {
  if (n === null || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const end = new Date(`${expiresAt}T23:59:59`);
  return end.getTime() < Date.now();
}

function emptyReviewForm(): CertificationExtractedMetadata {
  return {
    certification_type: "other",
    title: null,
    trainee_name: null,
    issued_at: null,
    expires_at: null,
    issuing_organization: null,
    certificate_number: null,
    confidence: "medium",
    notes: null,
  };
}

function fileIconForName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return FileText;
  return FileImage;
}

function AlertBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.04] px-4 py-3 text-sm text-destructive"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

function WizardProgress({ step }: { step: WizardStep }) {
  const activeIndex = step === "upload" ? 0 : 1;

  return (
    <nav aria-label="Upload progress">
      <ol className="flex items-center gap-0">
        {WIZARD_STEPS.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={s.id} className="flex items-center">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-primary text-primary-foreground",
                    !done && !active && "border border-border bg-background text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.short}
                </span>
              </div>
              {i < WIZARD_STEPS.length - 1 ? (
                <span className="mx-4 inline-block h-px w-10 bg-border sm:w-14" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide text-muted-foreground">{children}</p>
  );
}

/** Soft inset fields that sit flush with the certification review canvas. */
const reviewFieldClass =
  "h-11 w-full rounded-xl border-0 bg-muted/25 px-3.5 text-sm shadow-none ring-1 ring-border/10 transition-[background-color,box-shadow] placeholder:text-muted-foreground/55 hover:bg-muted/35 focus-visible:bg-background/95 focus-visible:ring-[3px] focus-visible:ring-primary/15 dark:bg-muted/15 dark:hover:bg-muted/25";

const reviewTextareaClass = cn(
  reviewFieldClass,
  "field-sizing-content min-h-[5rem] h-auto resize-none py-3 leading-relaxed",
);

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-muted/[0.06] p-4 sm:p-5">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ReviewField({
  id,
  label,
  children,
  className,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function CertificateListPanel({
  certifications,
  removingId,
  onDownload,
  onRemove,
}: {
  certifications: ComplianceCertification[];
  removingId: string | null;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className={cn(dashboardCardClass, "flex h-full flex-col overflow-hidden")}>
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Your certificates</CardTitle>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {certifications.length}
          </span>
        </div>
        <CardDescription className="text-xs leading-relaxed">
          Saved training records visible to you and your IRB office.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-4">
        {certifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/10 px-4 py-10 text-center">
            <ShieldCheck className="mb-3 size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-sm font-medium text-foreground">No certificates yet</p>
            <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
              Upload CITI, HIPAA, or other compliance training to keep your record current.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {certifications.map((cert) => {
              const expired = isExpired(cert.expires_at);
              const FileIcon = fileIconForName(cert.file_name);
              return (
                <li
                  key={cert.id}
                  className={cn(
                    "group rounded-lg border border-border/50 bg-background/60 p-3 transition-colors hover:border-border hover:bg-muted/20",
                    expired && "border-amber-500/25 bg-amber-500/[0.03]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                      <FileIcon className="size-4 text-muted-foreground" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {cert.title?.trim() || cert.file_name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {complianceCertificationTypeLabel(cert.certification_type)}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-muted-foreground/90">
                        {cert.issued_at
                          ? `Completed ${new Date(cert.issued_at).toLocaleDateString()}`
                          : `Uploaded ${new Date(cert.uploaded_at).toLocaleDateString()}`}
                        {cert.expires_at ? (
                          <span className={cn(expired && "font-medium text-amber-700 dark:text-amber-400")}>
                            {" · "}
                            {expired ? "Expired" : "Expires"}{" "}
                            {new Date(cert.expires_at).toLocaleDateString()}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex justify-end gap-1 opacity-100 sm:opacity-80 sm:group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 cursor-pointer gap-1.5 px-2.5 text-xs"
                      onClick={() => void onDownload(cert.id)}
                    >
                      <Download className="size-3.5" />
                      Download
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 cursor-pointer text-muted-foreground hover:text-destructive"
                      disabled={removingId === cert.id}
                      aria-label="Remove certificate"
                      onClick={() => void onRemove(cert.id)}
                    >
                      {removingId === cert.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function CertificationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allowed, setAllowed] = useState<"unknown" | "yes" | "no">("unknown");
  const [certifications, setCertifications] = useState<ComplianceCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [wizardStep, setWizardStep] = useState<WizardStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<CertificationExtractedMetadata>(emptyReviewForm);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadCertifications = useCallback(async () => {
    try {
      const rows = await db.getComplianceCertifications();
      setCertifications(rows);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load certificates.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const appUser = await db.getCurrentAppUser();
      if (cancelled) return;
      if (appUser?.role !== "pi") {
        setAllowed("no");
        router.replace("/dashboard");
        return;
      }
      setAllowed("yes");
      try {
        await loadCertifications();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadCertifications]);

  function resetWizard() {
    setWizardStep("upload");
    setSelectedFile(null);
    setReviewForm(emptyReviewForm());
    setAnalyzeError(null);
    setSaveError(null);
    setAnalyzing(false);
    setSaving(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickFile(file: File | null) {
    if (!file) return;
    if (file.size > COMPLIANCE_CERTIFICATION_MAX_BYTES) {
      setAnalyzeError("File too large (max 16 MB).");
      return;
    }
    setAnalyzeError(null);
    setSelectedFile(file);
  }

  async function handleAnalyze() {
    if (!selectedFile) {
      setAnalyzeError("Choose a certificate file to continue.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await db.analyzeComplianceCertification(selectedFile);
      setReviewForm(result.extracted);
      setWizardStep("review");
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Could not analyze certificate.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!selectedFile) return;
    setSaving(true);
    setSaveError(null);
    try {
      const row = await db.uploadComplianceCertification({
        file: selectedFile,
        certification_type: reviewForm.certification_type,
        title: reviewForm.title ?? undefined,
        trainee_name: reviewForm.trainee_name ?? undefined,
        issued_at: reviewForm.issued_at ?? undefined,
        expires_at: reviewForm.expires_at ?? undefined,
        extracted_metadata: reviewForm,
      });
      setCertifications((prev) => [row, ...prev]);
      resetWizard();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function updateReviewField<K extends keyof CertificationExtractedMetadata>(
    key: K,
    value: CertificationExtractedMetadata[K],
  ) {
    setReviewForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleDownload(id: string) {
    try {
      const { download_url, file_name } = await db.getComplianceCertificationDownload(id);
      const a = document.createElement("a");
      a.href = download_url;
      a.download = file_name;
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      // ignore
    }
  }

  async function handleRemove(id: string) {
    const row = certifications.find((c) => c.id === id);
    const ok = window.confirm(
      row
        ? `Remove “${row.title?.trim() || row.file_name}” from your list? The file stays on record for your institution.`
        : "Remove this certificate from your list?",
    );
    if (!ok) return;
    setRemovingId(id);
    try {
      await db.deleteComplianceCertification(id);
      setCertifications((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not remove certificate.");
    } finally {
      setRemovingId(null);
    }
  }

  if (allowed !== "yes" || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  const SelectedFileIcon = selectedFile ? fileIconForName(selectedFile.name) : Upload;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5 shrink-0 cursor-pointer"
          render={<Link href="/dashboard" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Compliance
          </p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight text-foreground md:text-3xl">
            Certification
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Upload your training certificate. We extract the details automatically—you review and save
            when everything looks right.
          </p>
        </div>
      </div>

      {loadError ? <AlertBanner>{loadError}</AlertBanner> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className={cn(dashboardCardClass, "overflow-hidden")}>
          <div className="border-b border-border/40 px-6 py-4">
            <WizardProgress step={wizardStep} />
            <p className="mt-2 text-sm text-muted-foreground">
              {wizardStep === "upload"
                ? "PDF or image (PNG, JPEG, WebP), up to 16 MB."
                : "Edit any field before saving. Your file is not stored until you confirm."}
            </p>
          </div>

          <CardContent className="space-y-6 p-6">
            {wizardStep === "upload" ? (
              <>
                <div
                  className={cn(
                    "relative rounded-xl border-2 border-dashed transition-all duration-200",
                    analyzing && "pointer-events-none opacity-60",
                    dragOver
                      ? "border-primary/50 bg-primary/[0.04]"
                      : selectedFile
                        ? "border-border/60 bg-muted/10"
                        : "border-border/50 bg-muted/[0.06] hover:border-border hover:bg-muted/15",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  {selectedFile ? (
                    <div className="flex flex-col items-center px-6 py-8 text-center sm:flex-row sm:text-left">
                      <span className="mb-4 flex size-14 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/50 sm:mb-0 sm:mr-5">
                        <SelectedFileIcon className="size-6 text-primary" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{selectedFile.name}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                        <Button
                          type="button"
                          variant="link"
                          className="mt-2 h-auto cursor-pointer p-0 text-sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose a different file
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full cursor-pointer flex-col items-center px-6 py-8 text-center"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/40">
                        <Upload className="size-5 text-muted-foreground" aria-hidden />
                      </span>
                      <p className="text-sm font-medium text-foreground">Drop your certificate here</p>
                      <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
                      <p className="mt-3 text-xs text-muted-foreground/80">PDF, PNG, JPEG, or WebP · max 16 MB</p>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept={COMPLIANCE_CERTIFICATION_ACCEPT}
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                  {analyzing ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[1px]">
                      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-4 py-3 shadow-sm">
                        <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                        <span className="text-sm font-medium text-foreground">Reading certificate…</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {analyzeError ? <AlertBanner>{analyzeError}</AlertBanner> : null}
              </>
            ) : (
              <>
                {selectedFile ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-muted/[0.06] px-4 py-3">
                    <SelectedFileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                    </div>
                  </div>
                ) : null}

                {reviewForm.confidence === "low" ? (
                  <div className="flex gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.04] px-4 py-3.5" role="alert">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-destructive">This file does not appear to be a training certificate</p>
                      <p className="mt-0.5 leading-relaxed text-muted-foreground">
                        Please upload a compliance training certificate such as a CITI completion report, HIPAA training certificate, or similar document.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 rounded-2xl bg-emerald-500/[0.04] px-4 py-3.5">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600/80 dark:text-emerald-400/90" aria-hidden />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-foreground">Certificate details extracted</p>
                      <p className="mt-0.5 leading-relaxed text-muted-foreground">
                        Review the information below and correct anything that looks off before saving.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <ReviewSection title="Certificate details">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ReviewField id="review-type" label="Type" className="sm:col-span-2">
                        <Select
                          value={reviewForm.certification_type}
                          onValueChange={(v) =>
                            updateReviewField("certification_type", v as ComplianceCertificationType)
                          }
                        >
                          <SelectTrigger id="review-type" className={cn(reviewFieldClass, "w-full cursor-pointer")}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {COMPLIANCE_CERTIFICATION_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ReviewField>
                      <ReviewField id="review-title" label="Title / course name" className="sm:col-span-2">
                        <Input
                          id="review-title"
                          className={reviewFieldClass}
                          value={reviewForm.title ?? ""}
                          onChange={(e) => updateReviewField("title", e.target.value || null)}
                          placeholder="e.g. Basic Course in Human Subjects Research"
                          maxLength={200}
                        />
                      </ReviewField>
                      <ReviewField id="review-trainee" label="Name on certificate">
                        <Input
                          id="review-trainee"
                          className={reviewFieldClass}
                          value={reviewForm.trainee_name ?? ""}
                          onChange={(e) => updateReviewField("trainee_name", e.target.value || null)}
                          placeholder="Full name"
                          maxLength={200}
                        />
                      </ReviewField>
                      <ReviewField id="review-org" label="Issuing organization">
                        <Input
                          id="review-org"
                          className={reviewFieldClass}
                          value={reviewForm.issuing_organization ?? ""}
                          onChange={(e) => updateReviewField("issuing_organization", e.target.value || null)}
                          placeholder="e.g. CITI Program"
                          maxLength={200}
                        />
                      </ReviewField>
                    </div>
                  </ReviewSection>

                  <ReviewSection title="Dates">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ReviewField id="review-issued" label="Completion date">
                        <Input
                          id="review-issued"
                          type="date"
                          className={reviewFieldClass}
                          value={reviewForm.issued_at ?? ""}
                          onChange={(e) => updateReviewField("issued_at", e.target.value || null)}
                        />
                      </ReviewField>
                      <ReviewField id="review-expires" label="Expiration date">
                        <Input
                          id="review-expires"
                          type="date"
                          className={reviewFieldClass}
                          value={reviewForm.expires_at ?? ""}
                          onChange={(e) => updateReviewField("expires_at", e.target.value || null)}
                        />
                      </ReviewField>
                    </div>
                  </ReviewSection>

                  <ReviewSection title="Additional information">
                    <div className="space-y-4">
                      <ReviewField id="review-number" label="Certificate / completion ID">
                        <Input
                          id="review-number"
                          className={reviewFieldClass}
                          value={reviewForm.certificate_number ?? ""}
                          onChange={(e) => updateReviewField("certificate_number", e.target.value || null)}
                          placeholder="Optional record number"
                          maxLength={100}
                        />
                      </ReviewField>
                      <ReviewField id="review-notes" label="Notes">
                        <Textarea
                          id="review-notes"
                          variant="md"
                          className={reviewTextareaClass}
                          value={reviewForm.notes ?? ""}
                          onChange={(e) => updateReviewField("notes", e.target.value || null)}
                          placeholder="Optional notes for your records"
                          rows={3}
                          maxLength={500}
                        />
                      </ReviewField>
                    </div>
                  </ReviewSection>
                </div>

                {saveError ? <AlertBanner>{saveError}</AlertBanner> : null}
              </>
            )}
          </CardContent>

          <div className="flex flex-col gap-3 border-t border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            {wizardStep === "review" ? (
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer text-muted-foreground sm:mr-auto"
                disabled={saving}
                onClick={resetWizard}
              >
                Back
              </Button>
            ) : null}
            {wizardStep === "upload" ? (
              <Button
                type="button"
                className="w-full cursor-pointer gap-2 sm:w-auto"
                disabled={analyzing || !selectedFile}
                onClick={() => void handleAnalyze()}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Analyzing…
                  </>
                ) : (
                  <>
                    Continue
                    <Sparkles className="size-4" aria-hidden />
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full cursor-pointer gap-2 sm:w-auto"
                disabled={saving || reviewForm.confidence === "low"}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="size-4" aria-hidden />
                )}
                {saving ? "Saving…" : "Save certificate"}
              </Button>
            )}
          </div>
        </Card>

        <CertificateListPanel
          certifications={certifications}
          removingId={removingId}
          onDownload={handleDownload}
          onRemove={handleRemove}
        />
      </div>
    </div>
  );
}
