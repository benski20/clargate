"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardCardClass, DashboardPageHeader } from "@/components/dashboard/dashboard-ui";
import { db } from "@/lib/database";
import { INSTITUTION_GUIDANCE_SECTIONS } from "@/lib/institution-guidance-sections";
import type { InstitutionAiGuidanceRow, UserRole } from "@/lib/types";

export default function PiInstitutionPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [items, setItems] = useState<InstitutionAiGuidanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const appUser = await db.getCurrentAppUser();
      if (!appUser?.role) {
        router.replace("/dashboard");
        return;
      }
      if (
        appUser.role !== "pi" &&
        appUser.role !== "admin" &&
        appUser.role !== "reviewer"
      ) {
        router.replace("/dashboard");
        return;
      }
      setRole(appUser.role);
      try {
        const [inst, guidance] = await Promise.all([db.getInstitution(), db.getInstitutionGuidance()]);
        setInstitutionName(typeof inst?.name === "string" ? inst.name : null);
        setItems(guidance);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not load institution information.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function downloadFile(id: string) {
    try {
      const { download_url, file_name } = await db.getInstitutionGuidanceFileDownload(id);
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

  if (loading || role === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  const byCategory = (c: InstitutionAiGuidanceRow["category"]) =>
    items.filter((i) => i.category === c).sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit cursor-pointer gap-2 px-0 text-muted-foreground hover:text-foreground"
          render={<Link href="/dashboard" />}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Button>
      </div>

      <DashboardPageHeader
        eyebrow="Your institution"
        title="Learn about your institution"
        description={
          role === "reviewer"
            ? institutionName
              ? `Read-only reference materials, rules, and guidelines for ${institutionName}. Administrators edit these in Configure; reviewers cannot change them here.`
              : "Read-only reference materials, rules, and guidelines for your institution—the same context used when you review submissions."
            : institutionName
              ? `Reference materials, rules, and guidelines configured for ${institutionName}—the same context Arbiter uses when helping you draft and review submissions.`
              : "Reference materials, rules, and guidelines your IRB office configured in Arbiter—the same context used when helping you draft and review submissions."
        }
      />

      {loadError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {items.length === 0 && !loadError ? (
        <Card className={dashboardCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              Nothing published yet
            </CardTitle>
            <CardDescription>
              {role === "reviewer" ? (
                <>
                  When your IRB administrator publishes example proposals, rules, guidelines, or institutional
                  specifics, they will appear here for reviewers and investigators.
                </>
              ) : (
                <>
                  When your IRB administrator adds example proposals, rules, guidelines, or institutional
                  specifics in <span className="font-medium text-foreground">Configure</span>, they will
                  appear here for your whole team.
                </>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="space-y-10">
        {INSTITUTION_GUIDANCE_SECTIONS.map((section) => {
          const rows = byCategory(section.category);
          if (rows.length === 0) return null;

          return (
            <section key={section.category} className="space-y-4">
              <div className="border-b border-border/60 pb-2">
                <h2 className="font-semibold text-lg tracking-tight text-foreground">{section.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
              </div>

              <ul className="space-y-4">
                {rows.map((row) => (
                  <li key={row.id}>
                    <Card className={dashboardCardClass}>
                      <CardHeader className="border-b border-border/40 pb-3">
                        <CardTitle className="text-base font-medium leading-snug">
                          {row.title?.trim() ||
                            (row.content_type === "file" ? row.file_name : "Guidance note")}
                        </CardTitle>
                        {row.content_type === "file" && row.file_name ? (
                          <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
                              <FileText className="h-3.5 w-3.5" />
                              {row.file_name}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 cursor-pointer gap-1.5"
                              onClick={() => void downloadFile(row.id)}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download original
                            </Button>
                          </CardDescription>
                        ) : null}
                      </CardHeader>
                      <CardContent className="pt-4">
                        {row.content_type === "text" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                              {(row.body_text ?? "").trim() || "—"}
                            </pre>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Extracted text (for search &amp; AI)
                            </p>
                            <div className="max-h-[min(24rem,50vh)] overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-4">
                              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                                {(row.extracted_text ?? "").trim() ||
                                  "No text could be extracted from this file."}
                              </pre>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
