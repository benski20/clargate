"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, FileUp, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { db } from "@/lib/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TreeView } from "@/components/ui/tree-view";
import { dashboardCardClass, DashboardPageHeader } from "@/components/dashboard/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  INSTITUTION_GUIDANCE_CATEGORY_SHORT,
  INSTITUTION_GUIDANCE_SECTIONS,
} from "@/lib/institution-guidance-sections";
import type { InstitutionAiGuidanceCategory, InstitutionAiGuidanceRow } from "@/lib/types";

const SECTIONS = INSTITUTION_GUIDANCE_SECTIONS;

function previewContent(row: InstitutionAiGuidanceRow): string {
  if (row.content_type === "text") {
    return (row.body_text ?? "").slice(0, 160);
  }
  return (row.extracted_text ?? "").slice(0, 160) || row.file_name || "";
}

export default function ConfigurePage() {
  const router = useRouter();
  const [access, setAccess] = useState<"loading" | "allowed" | "denied">("loading");
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
    (async () => {
      const appUser = await db.getCurrentAppUser();
      if (appUser?.role !== "admin") {
        router.replace("/dashboard");
        setAccess("denied");
        return;
      }
      setAccess("allowed");
    })();
  }, [router]);

  useEffect(() => {
    if (access !== "allowed") return;
    refresh()
      .catch(() => setLoadError("Could not load configuration"))
      .finally(() => setLoading(false));
  }, [access, refresh]);

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

  const [activeSection, setActiveSection] = useState<string | null>(SECTIONS[0].category);

  const treeData = [
    {
      id: "guidance-group",
      label: "AI Context Library",
      children: SECTIONS.map((s) => ({
        id: s.category,
        label: INSTITUTION_GUIDANCE_CATEGORY_SHORT[s.category],
      })),
    },
  ];

  if (access === "loading" || access === "denied") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

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
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="w-full shrink-0 md:w-64">
            <TreeView
              className="border-none bg-transparent p-0"
              data={treeData}
              defaultExpandedIds={["guidance-group"]}
              selectedIds={activeSection ? [activeSection] : []}
              onNodeClick={(node) => {
                if (node.children) return;
                setActiveSection(node.id);
              }}
              showIcons={false}
              showLines={false}
            />
          </div>
          <div className="min-w-0 flex-1">
            {SECTIONS.filter((s) => s.category === activeSection).map((section) => {
              const rows = byCategory(section.category);
              const busy = savingCategory === section.category || uploadingCategory === section.category;
              const mode = addMode[section.category];

              return (
                <Card
                  className={cn(dashboardCardClass, "border-0 bg-transparent shadow-none hover:shadow-none")}
                  key={section.category}
                >
                  <CardHeader className="border-b border-border/10 pb-4">
                    <div className="flex flex-col gap-1.5">
                      <CardTitle className="text-lg tracking-tight">
                        {section.title}
                      </CardTitle>
                      <p className="text-sm leading-relaxed text-muted-foreground">{section.description}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-8">
                    {rows.length > 0 ? (
                      <div>
                        <p className="mb-3 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Saved Items ({rows.length})
                        </p>
                        <ul className="space-y-3">
                          {rows.map((row) => (
                            <li
                              key={row.id}
                              className="flex items-start justify-between gap-4 rounded-xl border border-border/10 bg-muted/5 px-4 py-4"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium leading-snug text-foreground">
                                  {row.title?.trim() ||
                                    (row.content_type === "file" ? row.file_name : "Text note")}
                                </p>
                                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                                  {row.content_type === "file" ? "File · " : "Text · "}
                                  {previewContent(row)}
                                  {previewContent(row).length >= 160 ? "…" : ""}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground/70 hover:bg-muted/50"
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
                      <div className="rounded-xl border border-dashed border-border/15 bg-muted/5 px-6 py-12 text-center">
                        <p className="text-sm text-muted-foreground">
                          Nothing in this category yet. Add text or a file below.
                        </p>
                      </div>
                    )}

                    <div className="rounded-xl border border-border/10 bg-muted/5 p-5">
                      <p className="mb-5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-foreground">
                        Add new entry
                      </p>
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-foreground">Label (Optional)</label>
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
                            className="inline-flex rounded-lg border border-border/10 bg-muted/10 p-1"
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
                                  ? "bg-background/70 text-foreground ring-1 ring-border/20"
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
                                  ? "bg-background/70 text-foreground ring-1 ring-border/20"
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
                              className="min-h-[120px] resize-y rounded-lg border-border/20 bg-background/70 px-3 py-2.5 text-sm leading-relaxed shadow-none placeholder:text-muted-foreground/70"
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
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/15 bg-background/70 px-4 py-2.5 text-sm font-medium shadow-none transition-colors hover:bg-muted/20 disabled:opacity-50">
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
