"use client";

import { useState } from "react";
import { Download, FileImage, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { complianceCertificationTypeLabel } from "@/lib/compliance-certifications";
import { db } from "@/lib/database";
import type { ComplianceCertification, User } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatBytes(n: number | null): string {
  if (n === null || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(raw: string | null): string {
  if (!raw) return "—";
  return new Date(raw.includes("T") ? raw : `${raw}T12:00:00`).toLocaleDateString();
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(`${expiresAt}T23:59:59`).getTime() < Date.now();
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function CertificateCard({ cert }: { cert: ComplianceCertification }) {
  const [downloading, setDownloading] = useState(false);
  const expired = isExpired(cert.expires_at);
  const isPdf = cert.mime_type === "application/pdf" || cert.file_name.toLowerCase().endsWith(".pdf");
  const FileIcon = isPdf ? FileText : FileImage;

  async function handleDownload() {
    setDownloading(true);
    try {
      const { download_url, file_name } = await db.getComplianceCertificationDownload(cert.id);
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
    } finally {
      setDownloading(false);
    }
  }

  const meta = cert.extracted_metadata as Record<string, unknown> | null;
  const issuingOrg =
    cert.extracted_metadata && typeof meta?.issuing_organization === "string"
      ? meta.issuing_organization
      : null;
  const certNumber =
    cert.extracted_metadata && typeof meta?.certificate_number === "string" ? meta.certificate_number : null;
  const aiNotes = cert.extracted_metadata && typeof meta?.notes === "string" ? meta.notes : null;

  return (
    <article className="rounded-xl border border-border/60 bg-muted/10 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border/50">
            <FileIcon className="size-4 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-medium text-foreground leading-snug">
              {cert.title?.trim() || cert.file_name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {complianceCertificationTypeLabel(cert.certification_type)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {expired ? (
            <Badge variant="secondary" className="border-0 bg-amber-500/15 text-amber-800 dark:text-amber-300">
              Expired
            </Badge>
          ) : cert.expires_at ? (
            <Badge variant="secondary" className="border-0 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
              Current
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1.5"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
            Download file
          </Button>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-border/40 pt-5 sm:grid-cols-2 lg:grid-cols-3">
        <MetaField label="Name on certificate" value={cert.trainee_name?.trim() || "—"} />
        <MetaField label="Completion date" value={formatDate(cert.issued_at)} />
        <MetaField label="Expiration date" value={formatDate(cert.expires_at)} />
        <MetaField label="Issuing organization" value={issuingOrg?.trim() || "—"} />
        <MetaField label="Certificate ID" value={certNumber?.trim() || "—"} />
        <MetaField label="Uploaded" value={formatDate(cert.uploaded_at)} />
        <MetaField label="File" value={cert.file_name} />
        <MetaField label="Format" value={cert.mime_type} />
        <MetaField label="Size" value={formatBytes(cert.file_size_bytes)} />
      </dl>

      {aiNotes ? (
        <p className="mt-4 rounded-lg border border-border/40 bg-background/80 px-3 py-2.5 text-sm text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Notes: </span>
          {aiNotes}
        </p>
      ) : null}
    </article>
  );
}

export function AdminUserCertificatesDialog({
  user,
  certificates,
  open,
  onOpenChange,
}: {
  user: User | null;
  certificates: ComplianceCertification[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,720px)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b border-border/40 px-6 py-5 sm:px-8">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="size-4 text-primary" aria-hidden />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-xl">Compliance certificates</DialogTitle>
              <DialogDescription className="mt-1">
                {user.full_name} · {user.email}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {certificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No certificates on file for this user.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {certificates.length} certificate{certificates.length === 1 ? "" : "s"} on file
              </p>
              {certificates.map((cert) => (
                <CertificateCard key={cert.id} cert={cert} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUserCertificateCell({
  certificates,
  onShowMore,
}: {
  certificates: ComplianceCertification[];
  onShowMore: () => void;
}) {
  const hasCerts = certificates.length > 0;

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={cn("text-sm", hasCerts ? "font-medium text-foreground" : "text-muted-foreground")}>
        {hasCerts ? "Yes" : "No"}
      </span>
      {hasCerts ? (
        <button
          type="button"
          className="cursor-pointer text-xs font-medium text-primary underline-offset-2 hover:underline"
          onClick={onShowMore}
        >
          Show more
        </button>
      ) : null}
    </div>
  );
}
