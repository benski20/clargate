"use client";

import { useCallback, useEffect, useState } from "react";
import { BookMarked, FileUp, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dashboardCardClass, DashboardPageHeader } from "@/components/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";
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
      "Templates or de-identified samples that show the tone and structure your IRB expects.",
  },
  {
    category: "rules",
    title: "Proposal rules",
    description: "Non-negotiable requirements (sections, risk language, policy references).",
  },
  {
    category: "guidelines",
    title: "Guidelines",
    description: "Best practices, checklists, and interpretation notes.",
  },
  {
    category: "institutional",
    title: "Institutional specifics",
    description: "Local policies, ancillary boards, COI norms, and campus context.",
  },
];

const TAB_LABELS: Record<InstitutionAiGuidanceCategory, string> = {
  example_proposal: "Examples",
  rules: "Rules",
  guidelines: "Guidelines",
  institutional: "Institution",
};

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
  const [addMode, setAddMode] = useState<Record<InstitutionAiGuidanceCategory, "text" | "file">>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.category, "text" as const])) as Record<
      InstitutionAiGuidanceCategory,
      "text" | "file"
    >,
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
      setTextDraft((d) => ({ ...d, [category]: { ...d[category], title: "" } }));
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

  const totalItems = items.length;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Administration"
        title="Configure"
        description="Institution-specific text and files are merged into AI prompts for PIs (intake, consent, compliance, revisions)."
      />

      {loadError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : (
        <Card className={dashboardCardClass}>
          <CardHeader className="space-y-3 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <CardTitle className="flex items-center gap-2.5 font-semibold text-xl tracking-tight text-foreground">
                <BookMarked className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                AI context library
              </CardTitle>
              <p className="font-mono text-[0.65rem] font-normal uppercase tracking-[0.16em] text-muted-foreground">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </p>
            </div>
            <p className="max-w-2xl text-sm leading-[1.6] text-muted-foreground">
              Pick a category, review what is saved, then add text or upload a file.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={SECTIONS[0].category} className="gap-0">
              <TabsList
                variant="line"
                className="mb-8 h-auto w-full flex-wrap justify-start gap-1 rounded-none border-0 border-b border-border/70 bg-transparent p-0 pb-px"
              >
                {SECTIONS.map((section) => {
                  const n = byCategory(section.category).length;
                  return (
                    <TabsTrigger
                      key={section.category}
                      value={section.category}
                      className={cn(
                        "cursor-pointer rounded-md border border-transparent px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                        "text-muted-foreground hover:text-foreground",
                        "data-active:border-border/80 data-active:bg-muted/40 data-active:text-foreground data-active:shadow-none",
                      )}
                    >
                      {TAB_LABELS[section.category]}
                      {n > 0 ? (
                        <span className="ml-1.5 rounded border border-border/60 bg-background px-1.5 py-px text-[0.65rem] font-medium tabular-nums text-muted-foreground">
                          {n}
                        </span>
                      ) : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {SECTIONS.map((section) => {
                const rows = byCategory(section.category);
                const busy = savingCategory === section.category || uploadingCategory === section.category;
                const mode = addMode[section.category];

                return (
                  <TabsContent key={section.category} value={section.category} className="mt-0 space-y-6">
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-lg tracking-tight text-foreground">
                        {section.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{section.description}</p>
                    </div>

                    {rows.length > 0 ? (
                      <div>
                        <p className="mb-2 font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Saved
                        </p>
                        <ul className="space-y-2">
                          {rows.map((row) => (
                            <li
                              key={row.id}
                              className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-muted/25 px-4 py-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium leading-snug text-foreground">
                                  {row.title?.trim() ||
                                    (row.content_type === "file" ? row.file_name : "Text note")}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
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
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">
                        Nothing in this category yet. Add text or a file below.
                      </p>
                    )}

                    <div className="rounded-xl border border-border/80 bg-muted/15 p-4 sm:p-5">
                      <p className="mb-4 font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Add entry
                      </p>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">Optional label</label>
                          <Input
                            data-upload-title={section.category}
                            placeholder="e.g. Social-behavioral template"
                            value={textDraft[section.category].title}
                            onChange={(e) =>
                              setTextDraft((d) => ({
                                ...d,
                                [section.category]: { ...d[section.category], title: e.target.value },
                              }))
                            }
                            className="h-10 rounded-lg border-border/80 bg-background text-sm shadow-none"
                            disabled={busy}
                          />
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-medium text-foreground">Content source</p>
                          <div
                            className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-1"
                            role="group"
                            aria-label="How to add content"
                          >
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setAddMode((m) => ({ ...m, [section.category]: "text" }))}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                mode === "text"
                                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                              )}
                            >
                              <Pencil className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
                              Paste text
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setAddMode((m) => ({ ...m, [section.category]: "file" }))}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                mode === "file"
                                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                              )}
                            >
                              <FileUp className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
                              Upload file
                            </button>
                          </div>
                        </div>

                        {mode === "text" ? (
                          <div className="space-y-3">
                            <Textarea
                              placeholder="Paste policy text, bullet rules, or checklist items…"
                              value={textDraft[section.category].body}
                              onChange={(e) =>
                                setTextDraft((d) => ({
                                  ...d,
                                  [section.category]: { ...d[section.category], body: e.target.value },
                                }))
                              }
                              className="min-h-[120px] resize-y rounded-lg border-border/80 bg-background px-3 py-2.5 text-sm leading-relaxed shadow-none placeholder:text-muted-foreground/70"
                              disabled={busy}
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 cursor-pointer rounded-md px-4 font-medium"
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
                        ) : (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-background px-3.5 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted/60 disabled:opacity-50">
                                <Upload className="h-4 w-4 opacity-80" strokeWidth={2} />
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
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              PDF or plain text · max 50 MB · extraction quality affects AI use.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
