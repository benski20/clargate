"use client";

import { useCallback, useEffect, useState } from "react";
import { BookMarked, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  dashboardCardClass,
  dashboardInputClass,
  DashboardPageHeader,
} from "@/components/dashboard/dashboard-ui";
import type { InstitutionAiGuidanceCategory, InstitutionAiGuidanceRow } from "@/lib/types";

const SECTIONS: {
  category: InstitutionAiGuidanceCategory;
  title: string;
  description: string;
}[] = [
  {
    category: "example_proposal",
    title: "Example proposals",
    description:
      "De-identified or template proposals that show the tone, structure, and depth your IRB expects.",
  },
  {
    category: "rules",
    title: "Proposal rules",
    description:
      "Hard requirements (e.g. required sections, risk language, local policy references) the AI must treat as non-negotiable.",
  },
  {
    category: "guidelines",
    title: "Guidelines",
    description:
      "Best-practice guidance, checklists, and interpretation notes for reviewers and PIs.",
  },
  {
    category: "institutional",
    title: "Institutional specifics",
    description:
      "Campus-specific policies, ancillary boards, data agreements, COI norms, and other local context.",
  },
];

function previewContent(row: InstitutionAiGuidanceRow): string {
  if (row.content_type === "text") {
    return (row.body_text ?? "").slice(0, 160);
  }
  return (row.extracted_text ?? "").slice(0, 160) || row.file_name || "";
}

export default function ConfigurePage() {
  const [items, setItems] = useState<InstitutionAiGuidanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<Record<InstitutionAiGuidanceCategory, { title: string; body: string }>>(
    () =>
      Object.fromEntries(
        SECTIONS.map((s) => [s.category, { title: "", body: "" }]),
      ) as Record<InstitutionAiGuidanceCategory, { title: string; body: string }>,
  );
  const [savingCategory, setSavingCategory] = useState<InstitutionAiGuidanceCategory | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<InstitutionAiGuidanceCategory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/admin/institution-guidance");
    const data = (await res.json()) as { items?: InstitutionAiGuidanceRow[]; error?: string };
    if (!res.ok) {
      setLoadError(data.error || "Could not load configuration");
      setItems([]);
      return;
    }
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => setLoadError("Could not load configuration"))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function saveText(category: InstitutionAiGuidanceCategory) {
    const draft = textDraft[category];
    const body = draft.body.trim();
    if (!body) return;
    setSavingCategory(category);
    try {
      const res = await fetch("/api/admin/institution-guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: draft.title.trim() || undefined,
          body_text: body,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      setTextDraft((d) => ({ ...d, [category]: { title: "", body: "" } }));
      await refresh();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingCategory(null);
    }
  }

  async function uploadFile(category: InstitutionAiGuidanceCategory, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setUploadingCategory(category);
    setLoadError(null);
    try {
      const fd = new FormData();
      fd.set("category", category);
      fd.set("file", file);
      const titleEl = document.querySelector<HTMLInputElement>(`input[data-upload-title="${category}"]`);
      const t = titleEl?.value?.trim();
      if (t) fd.set("title", t);

      const res = await fetch("/api/admin/institution-guidance/upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (titleEl) titleEl.value = "";
      await refresh();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingCategory(null);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/institution-guidance/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await refresh();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const byCategory = (c: InstitutionAiGuidanceCategory) =>
    items.filter((i) => i.category === c).sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        eyebrow="Administration"
        title="Configure"
        description="Upload examples, rules, guidelines, and institutional context. Signed-in PIs receive this material in the AI intake, consent, compliance, and revision steps for your institution."
      />

      {loadError && (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((section) => {
            const rows = byCategory(section.category);
            const busy = savingCategory === section.category || uploadingCategory === section.category;

            return (
              <Card key={section.category} className={dashboardCardClass}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 font-[var(--font-heading)] text-lg font-medium">
                    <BookMarked className="h-5 w-5 text-muted-foreground" />
                    {section.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rows.length > 0 && (
                    <ul className="space-y-2">
                      {rows.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border border-border/80 bg-muted/30 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {row.title?.trim() ||
                                (row.content_type === "file" ? row.file_name : "Text note")}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {row.content_type === "file" ? "File · " : "Text · "}
                              {previewContent(row)}
                              {previewContent(row).length >= 160 ? "…" : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                            disabled={deletingId === row.id}
                            onClick={() => void remove(row.id)}
                            aria-label="Remove"
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Label for file upload (optional)
                      </label>
                      <Input
                        data-upload-title={section.category}
                        placeholder="e.g. Social-behavioral template"
                        className={dashboardInputClass}
                        disabled={busy}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Add as text
                      </label>
                      <Textarea
                        placeholder="Paste policy text, bullet rules, or checklist items…"
                        value={textDraft[section.category].body}
                        onChange={(e) =>
                          setTextDraft((d) => ({
                            ...d,
                            [section.category]: { ...d[section.category], body: e.target.value },
                          }))
                        }
                        className={`min-h-[100px] ${dashboardInputClass}`}
                        disabled={busy}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Input
                          placeholder="Short title for this block (optional)"
                          value={textDraft[section.category].title}
                          onChange={(e) =>
                            setTextDraft((d) => ({
                              ...d,
                              [section.category]: { ...d[section.category], title: e.target.value },
                            }))
                          }
                          className={`max-w-md ${dashboardInputClass}`}
                          disabled={busy}
                        />
                        <Button
                          type="button"
                          className="cursor-pointer rounded-full"
                          disabled={busy || !textDraft[section.category].body.trim()}
                          onClick={() => void saveText(section.category)}
                        >
                          {savingCategory === section.category ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Save text"
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Upload PDF or text file
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50">
                          <Upload className="h-4 w-4" />
                          Choose file
                          <input
                            type="file"
                            className="sr-only"
                            accept=".pdf,.txt,.md,.csv,.json,.html,.xml"
                            disabled={busy}
                            onChange={(e) => {
                              void uploadFile(section.category, e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {uploadingCategory === section.category && (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Max 50 MB. PDFs and plain text extract best for the model.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
