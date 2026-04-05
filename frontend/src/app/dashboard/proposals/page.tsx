"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { dashboardCardClass } from "@/components/dashboard/dashboard-ui";
import { db } from "@/lib/database";
import type { Proposal } from "@/lib/types";

export default function MyProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<"unknown" | "yes" | "no">("unknown");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await db.getCurrentAppUser();
      if (cancelled) return;
      if (u?.role !== "pi") {
        setAllowed("no");
        router.replace("/dashboard");
        return;
      }
      setAllowed("yes");
      try {
        const list = await db.getProposals({ pageSize: 100 });
        if (!cancelled) setProposals(list);
      } catch {
        if (!cancelled) setProposals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function hideDraftFromList(proposalId: string) {
    const ok = window.confirm(
      "Remove this draft from your list? The submission is not deleted—it stays on record for your institution, but it will no longer appear here.",
    );
    if (!ok) return;
    setRemovingId(proposalId);
    try {
      await db.hideDraftFromPiList(proposalId);
      setProposals((prev) => prev.filter((p) => p.id !== proposalId));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not remove this draft from your list.");
    } finally {
      setRemovingId(null);
    }
  }

  if (allowed !== "yes") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 cursor-pointer"
            render={<Link href="/dashboard" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-2xl tracking-tight md:text-3xl">
              My proposals
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Open a proposal for details, messages, and documents, or start a new submission.
            </p>
          </div>
        </div>
        <Button
          className="h-9 w-full shrink-0 cursor-pointer gap-2 rounded-md bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto"
          render={<Link href="/dashboard/proposals/new" />}
        >
          <Plus className="h-4 w-4" />
          New proposal
        </Button>
      </div>

      <Card className={dashboardCardClass}>
        <CardHeader>
          <CardTitle className="font-semibold text-lg">All proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                No proposals yet. Create your first proposal to get started.
              </p>
              <Button
                className="mt-5 cursor-pointer gap-2 rounded-md bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                render={<Link href="/dashboard/proposals/new" />}
              >
                <Plus className="h-4 w-4" />
                New proposal
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 transition-colors duration-200 hover:border-border hover:bg-muted/50 sm:gap-2 sm:px-3 sm:py-2"
                >
                  <Link
                    href={`/dashboard/proposals/${p.id}`}
                    className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 px-2 py-1.5 sm:px-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{p.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Updated {new Date(p.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                  {p.status === "draft" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                      disabled={removingId === p.id}
                      title="Remove draft from this list"
                      aria-label={`Remove draft “${p.title}” from your list`}
                      onClick={(e) => {
                        e.preventDefault();
                        void hideDraftFromList(p.id);
                      }}
                    >
                      {removingId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
